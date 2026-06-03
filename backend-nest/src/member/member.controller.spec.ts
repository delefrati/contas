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
