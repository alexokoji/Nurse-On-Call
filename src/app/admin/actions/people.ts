'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { connectDB } from '@/lib/db/connect';
import {
  Availability,
  BlockedSchedule,
  PatientProfile,
  Role,
  StaffProfile,
  User,
  nextReference,
} from '@/models';
import { apiRequirePermission, AuthError } from '@/lib/auth/guards';
import { hashPassword } from '@/lib/auth/password';
import {
  adminUserSchema,
  availabilityOverrideSchema,
  blockedScheduleSchema,
  patientSchema,
  roleSchema,
  staffSchema,
} from '@/lib/validations/admin';
import { ALL_PERMISSIONS } from '@/lib/permissions/catalogue';
import { recordAudit } from '@/lib/audit';
import { normalisePhone } from '@/lib/utils';
import type { ActionResult } from '@/types';

function toResult<T = unknown>(error: unknown, fallback: string): ActionResult<T> {
  if (error instanceof AuthError) return { ok: false, message: error.message };
  if ((error as { code?: number }).code === 11000) {
    return { ok: false, message: 'That email address is already in use.' };
  }
  console.error('[admin:people]', error);
  return { ok: false, message: fallback };
}

/* ── Patients ─────────────────────────────────────────────────────── */

export async function savePatientAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const patientId = String(formData.get('patientId') ?? '');
    const isEdit = patientId.length > 0;

    const user = await apiRequirePermission(isEdit ? 'patients.edit' : 'patients.create');

    const parsed = patientSchema.safeParse({
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      password: formData.get('password') || undefined,
      dateOfBirth: formData.get('dateOfBirth') || undefined,
      gender: formData.get('gender') || undefined,
      address: {
        street: formData.get('street') || undefined,
        area: formData.get('area') || undefined,
        city: formData.get('city') || undefined,
        state: formData.get('state') || undefined,
        landmark: formData.get('landmark') || undefined,
      },
      bloodGroup: formData.get('bloodGroup') || undefined,
      allergies: splitList(formData.get('allergies')),
      chronicConditions: splitList(formData.get('chronicConditions')),
      emergencyContact: {
        name: formData.get('emergencyName') || undefined,
        relationship: formData.get('emergencyRelationship') || undefined,
        phone: formData.get('emergencyPhone') || undefined,
      },
      status: formData.get('status') || 'active',
      notes: formData.get('notes') || undefined,
    });

    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    await connectDB();
    const data = parsed.data;

    let targetId = patientId;

    if (isEdit) {
      const existing = await User.findOne({ _id: patientId, role: 'patient' });
      if (!existing) return { ok: false, message: 'Patient not found.' };

      const before = { name: existing.name, email: existing.email, status: existing.status };

      existing.name = data.name;
      existing.email = data.email;
      existing.phone = normalisePhone(data.phone);
      existing.status = data.status;
      if (data.password) {
        existing.password = await hashPassword(data.password);
        // A password reset by an admin invalidates the patient's sessions.
        existing.sessionVersion += 1;
      }
      await existing.save();

      await recordAudit({
        actor: user,
        action: 'patient.update',
        entity: 'User',
        entityId: patientId,
        summary: `Patient record updated for ${data.name}`,
        before,
        after: { name: data.name, email: data.email, status: data.status },
      });
    } else {
      const created = await User.create({
        name: data.name,
        email: data.email,
        phone: normalisePhone(data.phone),
        // Without a password the patient uses "forgot password" to set one.
        password: await hashPassword(data.password ?? randomBytes(24).toString('hex')),
        role: 'patient',
        status: data.status,
      });

      targetId = String(created._id);

      await recordAudit({
        actor: user,
        action: 'patient.create',
        entity: 'User',
        entityId: targetId,
        summary: `Patient ${data.name} created`,
        after: { name: data.name, email: data.email },
      });
    }

    await PatientProfile.findOneAndUpdate(
      { user: targetId },
      {
        user: targetId,
        // Only assign a number on first creation.
        ...(isEdit ? {} : { patientNumber: await nextReference('patient') }),
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        gender: data.gender,
        address: data.address,
        bloodGroup: data.bloodGroup,
        allergies: data.allergies,
        chronicConditions: data.chronicConditions,
        emergencyContact: data.emergencyContact,
        notes: data.notes,
      },
      { upsert: true, setDefaultsOnInsert: true },
    );

    revalidatePath('/admin/patients');
    revalidatePath(`/admin/patients/${targetId}`);

    return {
      ok: true,
      message: isEdit ? 'Patient record updated.' : 'Patient created.',
      data: { id: targetId },
    };
  } catch (error) {
    return toResult(error, 'We could not save that patient.');
  }
}

export async function setPatientStatusAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await apiRequirePermission('patients.delete');

    const parsed = z
      .object({
        patientId: z.string().min(1),
        status: z.enum(['active', 'inactive', 'suspended']),
      })
      .safeParse({
        patientId: formData.get('patientId'),
        status: formData.get('status'),
      });

    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    await connectDB();
    const patient = await User.findOne({ _id: parsed.data.patientId, role: 'patient' });
    if (!patient) return { ok: false, message: 'Patient not found.' };

    const before = { status: patient.status };
    patient.status = parsed.data.status;
    // Suspension takes effect immediately, not at token expiry.
    if (parsed.data.status !== 'active') patient.sessionVersion += 1;
    await patient.save();

    await recordAudit({
      actor: user,
      action: 'patient.status',
      entity: 'User',
      entityId: parsed.data.patientId,
      summary: `Patient ${patient.name} set to ${parsed.data.status}`,
      before,
      after: { status: parsed.data.status },
    });

    revalidatePath('/admin/patients');
    revalidatePath(`/admin/patients/${parsed.data.patientId}`);

    return { ok: true, message: `Account set to ${parsed.data.status}.` };
  } catch (error) {
    return toResult(error, 'We could not change that account status.');
  }
}

/* ── Staff ────────────────────────────────────────────────────────── */

export async function saveStaffAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const staffId = String(formData.get('staffId') ?? '');
    const isEdit = staffId.length > 0;

    const user = await apiRequirePermission('staff.manage');

    /* Working hours arrive as one JSON field — a table of seven rows is far
       simpler to submit that way than as 35 individual inputs. */
    let workingHours: unknown = [];
    try {
      workingHours = JSON.parse(String(formData.get('workingHours') ?? '[]'));
    } catch {
      return { ok: false, message: 'The working hours could not be read. Please try again.' };
    }

    const parsed = staffSchema.safeParse({
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      password: formData.get('password') || undefined,
      avatar: formData.get('avatar') || undefined,
      title: formData.get('title'),
      department: formData.get('department'),
      bio: formData.get('bio') || undefined,
      qualifications: splitList(formData.get('qualifications')),
      specialisations: splitList(formData.get('specialisations')),
      licenceNumber: formData.get('licenceNumber') || undefined,
      yearsOfExperience: formData.get('yearsOfExperience') || undefined,
      serviceIds: formData.getAll('serviceIds').map(String),
      workingHours,
      maxConcurrentAppointments: formData.get('maxConcurrentAppointments') || 1,
      isPubliclyVisible: formData.get('isPubliclyVisible') === 'on',
      isActive: formData.get('isActive') === 'on',
    });

    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    const data = parsed.data;

    if (!isEdit && !data.password) {
      return {
        ok: false,
        fieldErrors: { password: ['Set an initial password for the new staff account'] },
      };
    }

    await connectDB();

    let profileId = staffId;
    let userId: string;

    if (isEdit) {
      const profile = await StaffProfile.findById(staffId);
      if (!profile) return { ok: false, message: 'Staff member not found.' };
      userId = String(profile.user);

      const account = await User.findById(userId);
      if (!account) return { ok: false, message: 'Staff account not found.' };

      const before = { name: account.name, email: account.email, isActive: profile.isActive };

      account.name = data.name;
      account.email = data.email;
      account.phone = normalisePhone(data.phone);
      account.avatar = data.avatar || undefined;
      // Deactivating the profile disables the login too.
      account.status = data.isActive ? 'active' : 'inactive';
      if (data.password) {
        account.password = await hashPassword(data.password);
        account.sessionVersion += 1;
      }
      await account.save();

      await recordAudit({
        actor: user,
        action: 'staff.update',
        entity: 'StaffProfile',
        entityId: staffId,
        summary: `Staff member ${data.name} updated`,
        before,
        after: { name: data.name, email: data.email, isActive: data.isActive },
      });
    } else {
      const account = await User.create({
        name: data.name,
        email: data.email,
        phone: normalisePhone(data.phone),
        password: await hashPassword(data.password!),
        avatar: data.avatar || undefined,
        role: 'staff',
        status: data.isActive ? 'active' : 'inactive',
        emailVerifiedAt: new Date(),
      });

      userId = String(account._id);

      const profile = await StaffProfile.create({
        user: userId,
        staffNumber: await nextReference('staff'),
        title: data.title,
        department: data.department,
      });

      profileId = String(profile._id);

      await recordAudit({
        actor: user,
        action: 'staff.create',
        entity: 'StaffProfile',
        entityId: profileId,
        summary: `Staff member ${data.name} created (${data.title})`,
        after: { name: data.name, title: data.title, department: data.department },
      });
    }

    await StaffProfile.updateOne(
      { _id: profileId },
      {
        $set: {
          title: data.title,
          department: data.department,
          bio: data.bio,
          qualifications: data.qualifications,
          specialisations: data.specialisations,
          licenceNumber: data.licenceNumber,
          yearsOfExperience: data.yearsOfExperience,
          services: data.serviceIds,
          workingHours: data.workingHours,
          maxConcurrentAppointments: data.maxConcurrentAppointments,
          isPubliclyVisible: data.isPubliclyVisible,
          isActive: data.isActive,
        },
      },
    );

    revalidatePath('/admin/staff');
    revalidatePath(`/admin/staff/${profileId}`);
    revalidatePath('/team');

    return {
      ok: true,
      message: isEdit ? 'Staff member updated.' : 'Staff member created.',
      data: { id: profileId },
    };
  } catch (error) {
    return toResult(error, 'We could not save that staff member.');
  }
}

/* ── Scheduling ───────────────────────────────────────────────────── */

export async function saveBlockedScheduleAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await apiRequirePermission('staff.schedule');

    const parsed = blockedScheduleSchema.safeParse({
      staffId: formData.get('staffId') || null,
      type: formData.get('type') || 'blocked',
      startDateKey: formData.get('startDateKey'),
      endDateKey: formData.get('endDateKey'),
      startTime: formData.get('startTime') || '',
      endTime: formData.get('endTime') || '',
      reason: formData.get('reason') || undefined,
    });

    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    await connectDB();

    await BlockedSchedule.create({
      staff: parsed.data.staffId || null,
      type: parsed.data.type,
      startDateKey: parsed.data.startDateKey,
      endDateKey: parsed.data.endDateKey,
      startTime: parsed.data.startTime || undefined,
      endTime: parsed.data.endTime || undefined,
      reason: parsed.data.reason,
      approved: true,
      createdBy: user.id,
    });

    await recordAudit({
      actor: user,
      action: 'schedule.block',
      entity: 'BlockedSchedule',
      summary:
        `${parsed.data.type} added for ` +
        `${parsed.data.staffId ? 'one staff member' : 'the whole organisation'} ` +
        `(${parsed.data.startDateKey} – ${parsed.data.endDateKey})`,
      after: { ...parsed.data },
    });

    revalidatePath('/admin/schedule');
    if (parsed.data.staffId) revalidatePath(`/admin/staff/${parsed.data.staffId}`);

    return { ok: true, message: 'Time blocked. It is now excluded from availability.' };
  } catch (error) {
    return toResult(error, 'We could not block that time.');
  }
}

export async function removeBlockedScheduleAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await apiRequirePermission('staff.schedule');
    const blockId = String(formData.get('blockId') ?? '');
    if (!blockId) return { ok: false, message: 'Nothing to remove.' };

    await connectDB();
    const block = await BlockedSchedule.findByIdAndDelete(blockId);
    if (!block) return { ok: false, message: 'That block no longer exists.' };

    await recordAudit({
      actor: user,
      action: 'schedule.unblock',
      entity: 'BlockedSchedule',
      entityId: blockId,
      summary: `Removed ${block.type} for ${block.startDateKey} – ${block.endDateKey}`,
      before: { type: block.type, startDateKey: block.startDateKey },
    });

    revalidatePath('/admin/schedule');
    return { ok: true, message: 'Block removed — those times are bookable again.' };
  } catch (error) {
    return toResult(error, 'We could not remove that block.');
  }
}

export async function saveAvailabilityOverrideAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await apiRequirePermission('staff.schedule');

    const parsed = availabilityOverrideSchema.safeParse({
      staffId: formData.get('staffId'),
      dateKey: formData.get('dateKey'),
      start: formData.get('start'),
      end: formData.get('end'),
      note: formData.get('note') || undefined,
    });

    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    await connectDB();

    // An override replaces the recurring hours for that date entirely.
    await Availability.findOneAndUpdate(
      { staff: parsed.data.staffId, dateKey: parsed.data.dateKey },
      {
        staff: parsed.data.staffId,
        dateKey: parsed.data.dateKey,
        start: parsed.data.start,
        end: parsed.data.end,
        note: parsed.data.note,
        createdBy: user.id,
      },
      { upsert: true },
    );

    await recordAudit({
      actor: user,
      action: 'schedule.override',
      entity: 'Availability',
      summary: `Working hours overridden for ${parsed.data.dateKey} (${parsed.data.start}–${parsed.data.end})`,
      after: { ...parsed.data },
    });

    revalidatePath('/admin/schedule');
    return { ok: true, message: 'Availability override saved.' };
  } catch (error) {
    return toResult(error, 'We could not save that override.');
  }
}

/* ── Admin users & roles ──────────────────────────────────────────── */

export async function saveAdminUserAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await apiRequirePermission('users.manage');
    const userId = String(formData.get('userId') ?? '');
    const isEdit = userId.length > 0;

    const parsed = adminUserSchema.safeParse({
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone') || '',
      password: formData.get('password') || undefined,
      role: formData.get('role'),
      status: formData.get('status') || 'active',
    });

    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    const data = parsed.data;

    if (!isEdit && !data.password) {
      return { ok: false, fieldErrors: { password: ['Set an initial password'] } };
    }

    // Only a super admin may mint another super admin.
    if (data.role === 'super_admin' && actor.role !== 'super_admin') {
      return { ok: false, message: 'Only a super admin can grant the super admin role.' };
    }

    await connectDB();

    if (isEdit) {
      const account = await User.findById(userId);
      if (!account) return { ok: false, message: 'User not found.' };

      // Guard against removing the last super admin and locking everyone out.
      if (account.role === 'super_admin' && data.role !== 'super_admin') {
        const remaining = await User.countDocuments({
          role: 'super_admin',
          _id: { $ne: account._id },
        });
        if (remaining === 0) {
          return {
            ok: false,
            message: 'This is the only super admin. Promote someone else before changing this role.',
          };
        }
      }

      const before = { name: account.name, role: account.role, status: account.status };

      account.name = data.name;
      account.email = data.email;
      account.phone = data.phone ? normalisePhone(data.phone) : undefined;
      account.role = data.role;
      account.status = data.status;
      if (data.password) {
        account.password = await hashPassword(data.password);
        account.sessionVersion += 1;
      }
      // A role or status change must take effect immediately.
      if (before.role !== data.role || before.status !== data.status) {
        account.sessionVersion += 1;
      }
      await account.save();

      await recordAudit({
        actor,
        action: 'user.update',
        entity: 'User',
        entityId: userId,
        summary: `Admin user ${data.name} updated (${data.role})`,
        before,
        after: { name: data.name, role: data.role, status: data.status },
      });
    } else {
      const created = await User.create({
        name: data.name,
        email: data.email,
        phone: data.phone ? normalisePhone(data.phone) : undefined,
        password: await hashPassword(data.password!),
        role: data.role,
        status: data.status,
        emailVerifiedAt: new Date(),
      });

      await recordAudit({
        actor,
        action: 'user.create',
        entity: 'User',
        entityId: String(created._id),
        summary: `Admin user ${data.name} created with role ${data.role}`,
        after: { name: data.name, role: data.role },
      });
    }

    revalidatePath('/admin/users');
    return { ok: true, message: isEdit ? 'User updated.' : 'User created.' };
  } catch (error) {
    return toResult(error, 'We could not save that user.');
  }
}

export async function saveRoleAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await apiRequirePermission('roles.manage');

    const parsed = roleSchema.safeParse({
      key: formData.get('key'),
      name: formData.get('name'),
      description: formData.get('description') || undefined,
      permissions: formData.getAll('permissions').map(String),
    });

    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    // super_admin is defined in code as "everything" and is not editable.
    if (parsed.data.key === 'super_admin') {
      return { ok: false, message: 'The super admin role always holds every permission.' };
    }

    // Drop anything not in the catalogue rather than storing dead strings.
    const permissions = parsed.data.permissions.filter((permission) =>
      (ALL_PERMISSIONS as string[]).includes(permission),
    );

    await connectDB();
    const role = await Role.findOne({ key: parsed.data.key });
    if (!role) return { ok: false, message: 'Role not found.' };

    const before = { permissions: role.permissions };
    role.name = parsed.data.name;
    role.description = parsed.data.description;
    role.permissions = permissions;
    await role.save();

    await recordAudit({
      actor,
      action: 'role.update',
      entity: 'Role',
      entityId: String(role._id),
      summary: `Permissions updated for the ${role.name} role (${permissions.length} granted)`,
      before,
      after: { permissions },
    });

    revalidatePath('/admin/roles');
    return { ok: true, message: 'Role permissions saved and applied immediately.' };
  } catch (error) {
    return toResult(error, 'We could not save that role.');
  }
}

/* ── helpers ──────────────────────────────────────────────────────── */

function splitList(value: FormDataEntryValue | null): string[] {
  const text = String(value ?? '').trim();
  if (!text) return [];
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
