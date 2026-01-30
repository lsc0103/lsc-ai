/**
 * Skill Manager (Stub)
 * TODO: Implement full skill management functionality
 */

export interface Skill {
  name: string;
  description: string;
  requiresArgs: boolean;
  execute: (args?: string) => Promise<any>;
}

class SkillManager {
  private skills: Map<string, Skill> = new Map();

  register(skill: Skill): void {
    this.skills.set(skill.name, skill);
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  list(): Skill[] {
    return Array.from(this.skills.values());
  }

  remove(name: string): boolean {
    return this.skills.delete(name);
  }

  async execute(name: string, args: { rawArgs?: string }): Promise<any> {
    const skill = this.skills.get(name);
    if (!skill) {
      throw new Error(`Skill not found: ${name}`);
    }
    return skill.execute(args.rawArgs);
  }
}

export const skillManager = new SkillManager();
