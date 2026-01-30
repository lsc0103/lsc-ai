/**
 * Skill 模块导出
 */

export * from './types.js';
export * from './skillManager.js';
export * from './builtinSkills.js';

// 自动注册内置技能
import { skillManager } from './skillManager.js';
import { registerBuiltinSkills } from './builtinSkills.js';

// 在模块加载时自动注册内置技能
registerBuiltinSkills(skillManager);
