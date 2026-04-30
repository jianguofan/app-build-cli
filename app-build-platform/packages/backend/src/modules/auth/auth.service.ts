import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// 硬编码的管理员账号
const ADMIN_USER = {
  username: 'admin',
  password: 'snapmaker@2016', // Phase 1: 明文密码
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private jwtService: JwtService) {}

  async login(username: string, password: string) {
    this.logger.log(`Login attempt for user: ${username}`);

    // Phase 1：直接比较明文密码
    if (username === ADMIN_USER.username && password === ADMIN_USER.password) {
      const payload = { sub: 'admin', username: 'admin' };
      const access_token = this.jwtService.sign(payload);

      this.logger.log(`Login successful for user: ${username}`);

      return {
        access_token,
        expires_in: 86400, // 24 hours in seconds
        user: {
          username: 'admin',
        },
      };
    }

    this.logger.warn(`Login failed for user: ${username}`);
    throw new UnauthorizedException('用户名或密码错误');
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      return payload;
    } catch (error: any) {
      throw new UnauthorizedException('Token 无效或已过期');
    }
  }
}
