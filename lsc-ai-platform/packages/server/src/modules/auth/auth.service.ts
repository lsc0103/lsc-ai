import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';

interface JwtPayload {
  sub: string;
  username: string;
  roles: string[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('账户已被禁用');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      // 记录登录失败
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          loginFailCount: { increment: 1 },
          lastLoginFailAt: new Date(),
        },
      });
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 重置登录失败计数
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        loginFailCount: 0,
        lastLoginAt: new Date(),
      },
    });

    const roles = user.userRoles.map((ur) => ur.role.code);
    const tokens = await this.generateTokens(user.id, user.username, roles);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatar: user.avatar,
        roles,
      },
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          userRoles: {
            include: { role: true },
          },
        },
      });

      if (!user || user.status !== 'active') {
        throw new UnauthorizedException('无效的刷新令牌');
      }

      const roles = user.userRoles.map((ur) => ur.role.code);
      return this.generateTokens(user.id, user.username, roles);
    } catch {
      throw new UnauthorizedException('无效的刷新令牌');
    }
  }

  async logout(_userId: string) {
    // 可以在这里实现令牌黑名单逻辑
    return { message: '登出成功' };
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: { role: true },
        },
        userPermissions: true,
      },
    });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    const roles = user.userRoles.map((ur) => ur.role.code);

    // 收集所有权限
    const rolePermissions = user.userRoles.flatMap(
      (ur) => ur.role.permissions as string[],
    );
    const userGrants = user.userPermissions
      .filter((up) => up.effect === 'allow')
      .map((up) => up.permission);
    const userDenies = user.userPermissions
      .filter((up) => up.effect === 'deny')
      .map((up) => up.permission);

    // 计算最终权限: (角色权限 + 额外授权) - 禁用
    const permissions = [
      ...new Set([...rolePermissions, ...userGrants]),
    ].filter((p) => !userDenies.includes(p));

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      avatar: user.avatar,
      roles,
      permissions,
    };
  }

  private async generateTokens(
    userId: string,
    username: string,
    roles: string[],
  ) {
    const payload: JwtPayload = {
      sub: userId,
      username,
      roles,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
          '7d',
        ),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
    };
  }
}
