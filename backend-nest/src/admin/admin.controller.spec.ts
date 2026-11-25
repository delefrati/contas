import { AuthService } from '../auth/auth.service';
import { describeRequestBodies } from '../common/request-validation.testing';
import { AdminAuthController, AdminController } from './admin.controller';
import { AdminService } from './admin.service';

const resolves = () => jest.fn().mockResolvedValue({ id: 1 });

describeRequestBodies(
  'AdminController',
  () => ({
    controllers: [AdminAuthController, AdminController],
    services: [
      [AuthService, { adminLoginWithGoogle: resolves() }],
      [AdminService, {
        createBand: resolves(), updateBand: resolves(), createMember: resolves(), updateMember: resolves(),
        createSuperAdmin: resolves(),
      }],
    ],
  }),
  {
    accepts: [
      ['a sign-in', 'post', '/api/admin/auth/google', { credential: 'token' }],
      // AdminBands, AdminBand and AdminSuperAdmins
      ['a new band with its first member', 'post', '/api/admin/bands', {
        name: 'Maverick', slug: 'maverick', member: { name: 'Ana', email: 'ana@example.com' },
      }],
      ['a new band alone', 'post', '/api/admin/bands', { name: 'Maverick', slug: 'maverick' }],
      ['a renamed band', 'patch', '/api/admin/bands/1', { name: 'Maverick' }],
      ['a disabled band', 'patch', '/api/admin/bands/1', { active: false }],
      ['a new member', 'post', '/api/admin/bands/1/members', { name: 'Ana', email: '' }],
      ['a changed member', 'patch', '/api/admin/bands/1/members/2', { name: 'Ana', email: 'ana@example.com' }],
      ['a new super admin', 'post', '/api/admin/super-admins', { name: 'Bia', email: 'bia@example.com' }],
    ],
    refuses: [
      ['a sign-in without a credential', 'post', '/api/admin/auth/google', {}],
      ['an extra field on a band', 'post', '/api/admin/bands', { name: 'Maverick', slug: 'maverick', id: 9 }],
      ['an extra field on its first member', 'post', '/api/admin/bands', {
        name: 'Maverick', slug: 'maverick', member: { name: 'Ana', active: false },
      }],
      ['a first member that is not an object', 'post', '/api/admin/bands', { name: 'M', slug: 'm', member: 'Ana' }],
      ['active as text', 'patch', '/api/admin/bands/1', { active: 'false' }],
      ['a band name over 255 characters', 'patch', '/api/admin/bands/1', { name: 'x'.repeat(256) }],
      ['a member moved to another band', 'patch', '/api/admin/bands/1/members/2', { name: 'Ana', bandId: 3 }],
      ['an email that is not text', 'post', '/api/admin/super-admins', { name: 'Bia', email: true }],
    ],
  },
);
