/**
 * Barrel import for every model.
 *
 * Importing this module guarantees each schema is registered with Mongoose
 * before any `populate()` runs — without it, a lazily-imported ref throws
 * "MissingSchemaError" on the first request after a cold start.
 */
export { default as User } from './User';
export type { IUser } from './User';

export { default as PatientProfile } from './PatientProfile';
export type { IPatientProfile } from './PatientProfile';

export { default as StaffProfile } from './StaffProfile';
export type { IStaffProfile, IWorkingDay } from './StaffProfile';

export { default as Service } from './Service';
export type { IService } from './Service';

export { default as ServiceCategory } from './ServiceCategory';
export type { IServiceCategory } from './ServiceCategory';

export { default as Booking } from './Booking';
export type { IBooking } from './Booking';

export { default as Payment } from './Payment';
export type { IPayment } from './Payment';

export { default as Refund } from './Refund';
export type { IRefund } from './Refund';

export { default as Invoice } from './Invoice';
export type { IInvoice } from './Invoice';

export { default as Availability } from './Availability';
export type { IAvailability } from './Availability';

export { default as BlockedSchedule } from './BlockedSchedule';
export type { IBlockedSchedule } from './BlockedSchedule';

export { default as Review } from './Review';
export type { IReview } from './Review';

export { default as Notification } from './Notification';
export type { INotification } from './Notification';

export { default as AuditLog } from './AuditLog';
export type { IAuditLog } from './AuditLog';

export { default as SupportTicket } from './SupportTicket';
export type { ISupportTicket } from './SupportTicket';

export { default as HealthArticle } from './HealthArticle';
export type { IHealthArticle } from './HealthArticle';

export { default as Promotion } from './Promotion';
export type { IPromotion } from './Promotion';

export { default as Role } from './Role';
export type { IRole } from './Role';

export { default as Consent } from './Consent';
export type { IConsent } from './Consent';

export { default as Setting } from './Setting';
export type { ISetting, SettingGroup } from './Setting';

export { default as Counter, nextReference } from './Counter';
export type { CounterKey } from './Counter';
