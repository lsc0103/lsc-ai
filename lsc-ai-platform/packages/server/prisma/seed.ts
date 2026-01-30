import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化数据库...');

  // 创建超级管理员角色
  const adminRole = await prisma.role.upsert({
    where: { code: 'admin' },
    update: {},
    create: {
      code: 'admin',
      name: '超级管理员',
      description: '拥有系统所有权限',
      permissions: ['*'],
      isSystem: true,
    },
  });
  console.log('创建角色:', adminRole.name);

  // 创建系统管理员角色
  const sysAdminRole = await prisma.role.upsert({
    where: { code: 'sys_admin' },
    update: {},
    create: {
      code: 'sys_admin',
      name: '系统管理员',
      description: '系统配置与用户管理',
      permissions: ['admin:user', 'admin:role', 'admin:system', 'admin:audit', 'monitor:*'],
      isSystem: true,
    },
  });
  console.log('创建角色:', sysAdminRole.name);

  // 创建开发者角色
  const developerRole = await prisma.role.upsert({
    where: { code: 'developer' },
    update: {},
    create: {
      code: 'developer',
      name: '开发者',
      description: '完整功能使用',
      permissions: ['chat:*', 'workbench:*', 'project:*', 'task:*', 'rpa:*'],
      isSystem: true,
    },
  });
  console.log('创建角色:', developerRole.name);

  // 创建普通用户角色
  const userRole = await prisma.role.upsert({
    where: { code: 'user' },
    update: {},
    create: {
      code: 'user',
      name: '普通用户',
      description: '基础功能使用',
      permissions: ['chat:create', 'chat:read', 'workbench:use', 'project:read'],
      isSystem: true,
    },
  });
  console.log('创建角色:', userRole.name);

  // 创建 admin 账户
  const hashedPassword = await bcrypt.hash('Admin@123', 12);
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      email: 'admin@company.com',
      displayName: '系统管理员',
      status: 'active',
    },
  });
  console.log('创建用户:', adminUser.username);

  // 为 admin 分配超级管理员角色
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });
  console.log('为 admin 分配角色: 超级管理员');

  console.log('数据库初始化完成!');
  console.log('');
  console.log('默认管理员账户:');
  console.log('  用户名: admin');
  console.log('  密码: Admin@123');
  console.log('');
}

main()
  .catch((e) => {
    console.error('初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
