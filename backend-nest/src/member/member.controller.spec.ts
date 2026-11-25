import { describeRequestBodies } from '../common/request-validation.testing';
import { Test, TestingModule } from '@nestjs/testing';
import { MemberController } from './member.controller';
import { MemberService } from './member.service';

describe('MemberController', () => {
  let controller: MemberController;
  let memberService: {
    findAll: jest.Mock; findByEmail: jest.Mock; findByOidcSub: jest.Mock;
    create: jest.Mock; update: jest.Mock; toggleActive: jest.Mock; linkOidcSub: jest.Mock;
  };

  beforeEach(async () => {
    memberService = {
      findAll: jest.fn(),
      findByEmail: jest.fn(),
      findByOidcSub: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      toggleActive: jest.fn(),
      linkOidcSub: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MemberController],
      providers: [{ provide: MemberService, useValue: memberService }],
    }).compile();

    controller = module.get<MemberController>(MemberController);
  });

  describe('list', () => {
    it('should return all members', async () => {
      const members = [{ id: 1, name: 'Alice', active: true }];
      memberService.findAll.mockResolvedValue(members);

      const result = await controller.list();

      expect(result).toEqual({ data: members });
    });
  });

  describe('findByEmail', () => {
    it('should return member by email', async () => {
      const member = { id: 1, name: 'Alice', email: 'alice@test.com' };
      memberService.findByEmail.mockResolvedValue(member);

      const result = await controller.findByEmail('alice@test.com');

      expect(memberService.findByEmail).toHaveBeenCalledWith('alice@test.com');
      expect(result).toEqual({ data: member });
    });
  });

  describe('findByOidcSub', () => {
    it('should return member by oidcSub', async () => {
      const member = { id: 1, name: 'Alice', oidcSub: 'sub123' };
      memberService.findByOidcSub.mockResolvedValue(member);

      const result = await controller.findByOidcSub('sub123');

      expect(memberService.findByOidcSub).toHaveBeenCalledWith('sub123');
      expect(result).toEqual({ data: member });
    });
  });

  describe('create', () => {
    it('should create a member', async () => {
      const member = { id: 3, name: 'Charlie', email: 'c@test.com', active: true };
      memberService.create.mockResolvedValue(member);

      const result = await controller.create({ name: 'Charlie', email: 'c@test.com' });

      expect(memberService.create).toHaveBeenCalledWith('Charlie', 'c@test.com', undefined);
      expect(result).toEqual({ data: member });
    });
  });

  describe('update', () => {
    it('should update member', async () => {
      const member = { id: 1, name: 'New Name', active: true };
      memberService.update.mockResolvedValue(member);

      const result = await controller.update(1, { name: 'New Name' });

      expect(memberService.update).toHaveBeenCalledWith(1, 'New Name', undefined);
      expect(result).toEqual({ data: member });
    });
  });

  describe('toggleActive', () => {
    it('should toggle active status', async () => {
      const member = { id: 1, name: 'Alice', active: false };
      memberService.toggleActive.mockResolvedValue(member);

      const result = await controller.toggleActive(1);

      expect(memberService.toggleActive).toHaveBeenCalledWith(1);
      expect(result).toEqual({ data: member });
    });
  });

  describe('linkOidc', () => {
    it('should link oidc sub', async () => {
      const member = { id: 1, name: 'Alice', oidcSub: 'new-sub' };
      memberService.linkOidcSub.mockResolvedValue(member);

      const result = await controller.linkOidc(1, { oidcSub: 'new-sub' });

      expect(memberService.linkOidcSub).toHaveBeenCalledWith(1, 'new-sub');
      expect(result).toEqual({ data: member });
    });
  });
});

const resolves = () => jest.fn().mockResolvedValue({ id: 1 });

describeRequestBodies(
  'MemberController',
  () => ({
    controllers: [MemberController],
    services: [[MemberService, { create: resolves(), update: resolves(), linkOidcSub: resolves() }]],
  }),
  {
    accepts: [
      // Members and Settings
      ['a new member', 'post', '/api/members', { name: 'Ana', email: 'ana@example.com' }],
      ['a new member without an email', 'post', '/api/members', { name: 'Ana' }],
      ['a changed member', 'patch', '/api/members/1', { name: 'Ana', email: 'ana@example.com' }],
      ['one\'s own name', 'patch', '/api/members/1', { name: 'Ana' }],
      ['a linked Google account', 'patch', '/api/members/1/link-oidc', { oidcSub: '1234' }],
    ],
    refuses: [
      ['an extra field', 'patch', '/api/members/1', { name: 'Ana', active: false }],
      ['no name', 'post', '/api/members', { email: 'ana@example.com' }],
      ['a name that is not text', 'post', '/api/members', { name: 1 }],
      ['an email over 255 characters', 'patch', '/api/members/1', { email: `${'a'.repeat(250)}@example.com` }],
      ['no Google account to link', 'patch', '/api/members/1/link-oidc', {}],
    ],
  },
);
