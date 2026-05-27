import { MODULE_METADATA } from '@nestjs/common/constants';
import { UsersModule } from '../users/users.module';
import { AttacksModule } from './attacks.module';

describe('AttacksModule', () => {
  it('imports UsersModule for JwtAuthGuard dependencies', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      AttacksModule,
    ) as unknown[];

    expect(imports).toContain(UsersModule);
  });
});
