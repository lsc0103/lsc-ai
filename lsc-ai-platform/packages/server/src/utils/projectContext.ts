/**
 * 项目感知模块 - 高级版
 * 自动检测和深度理解项目结构
 *
 * 功能：
 * - LSC.md 项目指令文件支持（类似 CLAUDE.md）
 * - 代码风格检测（ESLint, Prettier, EditorConfig）
 * - CI/CD 检测（GitHub Actions, GitLab CI, etc.）
 * - 环境变量模板解析
 * - 数据库 Schema 检测
 * - API 端点发现
 * - 架构模式识别
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 项目类型
 */
export type ProjectType =
  | 'nodejs'
  | 'typescript'
  | 'python'
  | 'rust'
  | 'go'
  | 'java'
  | 'dotnet'
  | 'ruby'
  | 'php'
  | 'unknown';

/**
 * 代码风格配置
 */
export interface CodeStyleConfig {
  /** 是否使用 ESLint */
  eslint: boolean;
  /** ESLint 配置文件路径 */
  eslintConfig?: string;
  /** 是否使用 Prettier */
  prettier: boolean;
  /** Prettier 配置文件路径 */
  prettierConfig?: string;
  /** 是否使用 EditorConfig */
  editorConfig: boolean;
  /** 缩进风格 */
  indentStyle?: 'spaces' | 'tabs';
  /** 缩进大小 */
  indentSize?: number;
  /** 是否使用分号 */
  semicolons?: boolean;
  /** 引号风格 */
  quotes?: 'single' | 'double';
}

/**
 * CI/CD 配置
 */
export interface CICDConfig {
  /** CI/CD 平台 */
  platform?: 'github-actions' | 'gitlab-ci' | 'jenkins' | 'circleci' | 'travis' | 'azure-pipelines';
  /** 工作流文件路径 */
  configPath?: string;
  /** 检测到的作业/工作流 */
  workflows: string[];
  /** 是否有自动测试 */
  hasTests: boolean;
  /** 是否有自动部署 */
  hasDeploy: boolean;
  /** 是否有代码检查 */
  hasLint: boolean;
}

/**
 * 环境变量配置
 */
export interface EnvConfig {
  /** 环境变量模板文件 */
  templateFile?: string;
  /** 变量列表（从 .env.example 解析） */
  variables: Array<{
    name: string;
    description?: string;
    required: boolean;
    hasDefault: boolean;
  }>;
  /** 检测到的环境类型 */
  environments: string[];
}

/**
 * 数据库配置
 */
export interface DatabaseConfig {
  /** ORM/数据库框架 */
  orm?: 'prisma' | 'drizzle' | 'typeorm' | 'sequelize' | 'mongoose' | 'sqlalchemy' | 'django-orm';
  /** 数据库类型 */
  dbType?: 'postgresql' | 'mysql' | 'sqlite' | 'mongodb' | 'redis' | 'unknown';
  /** Schema 文件路径 */
  schemaPath?: string;
  /** 检测到的模型/表 */
  models: string[];
  /** 迁移目录 */
  migrationsPath?: string;
}

/**
 * API 端点配置
 */
export interface APIConfig {
  /** API 风格 */
  style?: 'rest' | 'graphql' | 'grpc' | 'trpc';
  /** 检测到的端点 */
  endpoints: Array<{
    method?: string;
    path: string;
    file?: string;
  }>;
  /** API 文档路径 */
  docsPath?: string;
  /** OpenAPI/Swagger 文件 */
  openApiPath?: string;
}

/**
 * 测试配置
 */
export interface TestConfig {
  /** 测试框架 */
  framework?: 'jest' | 'vitest' | 'mocha' | 'pytest' | 'go-test' | 'cargo-test';
  /** 配置文件 */
  configPath?: string;
  /** 测试目录 */
  testDirs: string[];
  /** 覆盖率配置 */
  hasCoverage: boolean;
}

/**
 * Docker 配置
 */
export interface DockerConfig {
  /** Dockerfile 路径 */
  dockerfile?: string;
  /** docker-compose 文件 */
  composePath?: string;
  /** 定义的服务 */
  services: string[];
  /** 是否使用多阶段构建 */
  multiStage: boolean;
}

/**
 * 项目指令文件 (LSC.md)
 */
export interface ProjectInstructions {
  /** 原始内容 */
  content: string;
  /** 项目描述 */
  description?: string;
  /** 代码规范 */
  codeStyle?: string;
  /** 架构说明 */
  architecture?: string;
  /** 重要文件 */
  importantFiles?: string[];
  /** 禁止修改的文件/目录 */
  doNotEdit?: string[];
  /** 自定义指令 */
  customInstructions?: string;
  /** 测试要求 */
  testingRequirements?: string;
  /** 提交规范 */
  commitConventions?: string;
}

/**
 * 架构模式
 */
export interface ArchitecturePattern {
  /** 架构类型 */
  type: 'monolith' | 'microservices' | 'serverless' | 'jamstack' | 'mvc' | 'clean-architecture' | 'unknown';
  /** 检测到的模式特征 */
  patterns: string[];
  /** 层次结构 */
  layers?: string[];
}

/**
 * 完整项目上下文信息
 */
export interface ProjectContext {
  /** 项目类型 */
  type: ProjectType;
  /** 项目名称 */
  name?: string;
  /** 项目描述 */
  description?: string;
  /** 版本 */
  version?: string;
  /** 使用的框架 */
  frameworks: string[];
  /** 主要依赖 */
  dependencies: string[];
  /** 开发依赖 */
  devDependencies: string[];
  /** 脚本命令 */
  scripts: Record<string, string>;
  /** 项目结构 */
  structure: string[];
  /** 是否为 monorepo */
  isMonorepo: boolean;
  /** Monorepo 包列表 */
  packages?: string[];
  /** Git 信息 */
  git: {
    branch?: string;
    remoteUrl?: string;
    hasUncommittedChanges?: boolean;
  };
  /** 项目指令 (LSC.md) */
  instructions?: ProjectInstructions;
  /** 代码风格配置 */
  codeStyle: CodeStyleConfig;
  /** CI/CD 配置 */
  cicd: CICDConfig;
  /** 环境变量配置 */
  env: EnvConfig;
  /** 数据库配置 */
  database: DatabaseConfig;
  /** API 配置 */
  api: APIConfig;
  /** 测试配置 */
  testing: TestConfig;
  /** Docker 配置 */
  docker: DockerConfig;
  /** 架构模式 */
  architecture: ArchitecturePattern;
  /** 原始配置内容 */
  rawConfig?: string;
  /** 检测时间戳 */
  detectedAt: number;
}

/**
 * 检测项目上下文（完整版）
 */
export async function detectProjectContext(cwd: string): Promise<ProjectContext> {
  const context: ProjectContext = {
    type: 'unknown',
    frameworks: [],
    dependencies: [],
    devDependencies: [],
    scripts: {},
    structure: [],
    isMonorepo: false,
    git: {},
    codeStyle: { eslint: false, prettier: false, editorConfig: false },
    cicd: { workflows: [], hasTests: false, hasDeploy: false, hasLint: false },
    env: { variables: [], environments: [] },
    database: { models: [] },
    api: { endpoints: [] },
    testing: { testDirs: [], hasCoverage: false },
    docker: { services: [], multiStage: false },
    architecture: { type: 'unknown', patterns: [] },
    detectedAt: Date.now(),
  };

  try {
    // 并行检测各项配置
    await Promise.all([
      detectProjectType(cwd, context),
      detectProjectInstructions(cwd, context),
      detectCodeStyle(cwd, context),
      detectCICD(cwd, context),
      detectEnvConfig(cwd, context),
      detectDatabase(cwd, context),
      detectAPI(cwd, context),
      detectTesting(cwd, context),
      detectDocker(cwd, context),
      detectStructure(cwd, context),
      detectGit(cwd, context),
    ]);

    // 检测架构模式（需要其他信息先就绪）
    detectArchitecture(context);

  } catch {
    // 忽略错误，返回部分结果
  }

  return context;
}

/**
 * 检测项目类型
 */
async function detectProjectType(cwd: string, context: ProjectContext): Promise<void> {
  // Node.js / TypeScript
  const packageJsonPath = path.join(cwd, 'package.json');
  if (await fileExists(packageJsonPath)) {
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);

    context.name = pkg.name;
    context.description = pkg.description;
    context.version = pkg.version;
    context.type = 'nodejs';

    // 检测 TypeScript
    if (await fileExists(path.join(cwd, 'tsconfig.json'))) {
      context.type = 'typescript';
    }

    // 收集依赖
    const deps = pkg.dependencies || {};
    const devDeps = pkg.devDependencies || {};
    context.dependencies = Object.keys(deps);
    context.devDependencies = Object.keys(devDeps);

    // 检测框架
    const allDeps = { ...deps, ...devDeps };
    context.frameworks = detectFrameworks(allDeps);
    context.scripts = pkg.scripts || {};

    // 检测 monorepo
    if (pkg.workspaces) {
      context.isMonorepo = true;
      context.packages = Array.isArray(pkg.workspaces)
        ? pkg.workspaces
        : pkg.workspaces.packages || [];
    } else if (await fileExists(path.join(cwd, 'pnpm-workspace.yaml'))) {
      context.isMonorepo = true;
      const wsContent = await fs.readFile(path.join(cwd, 'pnpm-workspace.yaml'), 'utf-8');
      const packagesMatch = wsContent.match(/packages:\s*\n((?:\s+-\s*.+\n?)+)/);
      if (packagesMatch && packagesMatch[1]) {
        context.packages = packagesMatch[1]
          .split('\n')
          .map(l => l.replace(/^\s*-\s*['"]?/, '').replace(/['"]?\s*$/, ''))
          .filter(Boolean);
      }
    } else if (await fileExists(path.join(cwd, 'lerna.json'))) {
      context.isMonorepo = true;
    }

    context.rawConfig = content;
    return;
  }

  // Python
  const pyprojectPath = path.join(cwd, 'pyproject.toml');
  const requirementsPath = path.join(cwd, 'requirements.txt');
  if (await fileExists(pyprojectPath)) {
    context.type = 'python';
    const content = await fs.readFile(pyprojectPath, 'utf-8');
    const nameMatch = content.match(/name\s*=\s*"([^"]+)"/);
    if (nameMatch && nameMatch[1]) context.name = nameMatch[1];
    const versionMatch = content.match(/version\s*=\s*"([^"]+)"/);
    if (versionMatch && versionMatch[1]) context.version = versionMatch[1];

    // 检测 Python 框架
    if (content.includes('django')) context.frameworks.push('Django');
    if (content.includes('flask')) context.frameworks.push('Flask');
    if (content.includes('fastapi')) context.frameworks.push('FastAPI');
    if (content.includes('pytest')) context.frameworks.push('pytest');

    context.rawConfig = content;
    return;
  } else if (await fileExists(requirementsPath)) {
    context.type = 'python';
    const content = await fs.readFile(requirementsPath, 'utf-8');
    context.dependencies = content.split('\n')
      .filter(line => line && line.trim() && !line.startsWith('#'))
      .map(line => {
        const parts1 = line.split('==');
        const parts2 = (parts1[0] || '').split('>=');
        const parts3 = (parts2[0] || '').split('[');
        return (parts3[0] || '').trim();
      })
      .filter(Boolean);
    return;
  }

  // Rust
  const cargoPath = path.join(cwd, 'Cargo.toml');
  if (await fileExists(cargoPath)) {
    context.type = 'rust';
    const content = await fs.readFile(cargoPath, 'utf-8');
    const nameMatch = content.match(/name\s*=\s*"([^"]+)"/);
    if (nameMatch && nameMatch[1]) context.name = nameMatch[1];
    const versionMatch = content.match(/version\s*=\s*"([^"]+)"/);
    if (versionMatch && versionMatch[1]) context.version = versionMatch[1];

    // 检测 workspace (Rust monorepo)
    if (content.includes('[workspace]')) {
      context.isMonorepo = true;
    }

    context.rawConfig = content;
    return;
  }

  // Go
  const goModPath = path.join(cwd, 'go.mod');
  if (await fileExists(goModPath)) {
    context.type = 'go';
    const content = await fs.readFile(goModPath, 'utf-8');
    const moduleMatch = content.match(/module\s+(.+)/);
    if (moduleMatch && moduleMatch[1]) context.name = moduleMatch[1].trim();
    context.rawConfig = content;
    return;
  }

  // Java (Maven)
  const pomPath = path.join(cwd, 'pom.xml');
  if (await fileExists(pomPath)) {
    context.type = 'java';
    const content = await fs.readFile(pomPath, 'utf-8');
    const artifactMatch = content.match(/<artifactId>([^<]+)<\/artifactId>/);
    if (artifactMatch && artifactMatch[1]) context.name = artifactMatch[1];

    if (content.includes('spring-boot')) context.frameworks.push('Spring Boot');

    context.rawConfig = content;
    return;
  }

  // Java (Gradle)
  const buildGradlePath = path.join(cwd, 'build.gradle');
  const buildGradleKtsPath = path.join(cwd, 'build.gradle.kts');
  if (await fileExists(buildGradlePath) || await fileExists(buildGradleKtsPath)) {
    context.type = 'java';
    return;
  }

  // .NET
  const csprojFiles = await findFiles(cwd, '*.csproj');
  if (csprojFiles.length > 0) {
    context.type = 'dotnet';
    return;
  }

  // Ruby
  const gemfilePath = path.join(cwd, 'Gemfile');
  if (await fileExists(gemfilePath)) {
    context.type = 'ruby';
    const content = await fs.readFile(gemfilePath, 'utf-8');
    if (content.includes('rails')) context.frameworks.push('Rails');
    return;
  }

  // PHP
  const composerPath = path.join(cwd, 'composer.json');
  if (await fileExists(composerPath)) {
    context.type = 'php';
    const content = await fs.readFile(composerPath, 'utf-8');
    const pkg = JSON.parse(content);
    context.name = pkg.name;

    if (pkg.require?.['laravel/framework']) context.frameworks.push('Laravel');
    if (pkg.require?.['symfony/framework-bundle']) context.frameworks.push('Symfony');
    return;
  }
}

/**
 * 检测 LSC.md 项目指令文件
 */
async function detectProjectInstructions(cwd: string, context: ProjectContext): Promise<void> {
  // 支持多种文件名
  const instructionFiles = [
    'LSC.md',
    'lsc.md',
    '.lsc.md',
    'CLAUDE.md',    // 兼容 Claude Code
    'claude.md',
    '.claude.md',
    'AI.md',
    '.ai.md',
    'INSTRUCTIONS.md',
  ];

  for (const filename of instructionFiles) {
    const filePath = path.join(cwd, filename);
    if (await fileExists(filePath)) {
      const content = await fs.readFile(filePath, 'utf-8');

      const instructions: ProjectInstructions = {
        content,
      };

      // 解析各节内容
      const sections = parseMarkdownSections(content);

      // 项目描述
      if (sections['项目描述'] || sections['description'] || sections['about']) {
        instructions.description = sections['项目描述'] || sections['description'] || sections['about'];
      }

      // 代码规范
      if (sections['代码规范'] || sections['code style'] || sections['coding standards']) {
        instructions.codeStyle = sections['代码规范'] || sections['code style'] || sections['coding standards'];
      }

      // 架构说明
      if (sections['架构'] || sections['architecture'] || sections['结构']) {
        instructions.architecture = sections['架构'] || sections['architecture'] || sections['结构'];
      }

      // 重要文件
      if (sections['重要文件'] || sections['important files'] || sections['key files']) {
        const filesSection = sections['重要文件'] || sections['important files'] || sections['key files'];
        if (filesSection) {
          instructions.importantFiles = extractListItems(filesSection);
        }
      }

      // 禁止修改
      if (sections['禁止修改'] || sections['do not edit'] || sections['readonly']) {
        const doNotEditSection = sections['禁止修改'] || sections['do not edit'] || sections['readonly'];
        if (doNotEditSection) {
          instructions.doNotEdit = extractListItems(doNotEditSection);
        }
      }

      // 测试要求
      if (sections['测试'] || sections['testing'] || sections['tests']) {
        instructions.testingRequirements = sections['测试'] || sections['testing'] || sections['tests'];
      }

      // 提交规范
      if (sections['提交规范'] || sections['commit'] || sections['git']) {
        instructions.commitConventions = sections['提交规范'] || sections['commit'] || sections['git'];
      }

      // 自定义指令（其他未分类内容）
      const knownSections = [
        '项目描述', 'description', 'about',
        '代码规范', 'code style', 'coding standards',
        '架构', 'architecture', '结构',
        '重要文件', 'important files', 'key files',
        '禁止修改', 'do not edit', 'readonly',
        '测试', 'testing', 'tests',
        '提交规范', 'commit', 'git',
      ];

      const customParts: string[] = [];
      for (const [key, value] of Object.entries(sections)) {
        if (!knownSections.includes(key.toLowerCase())) {
          customParts.push(`## ${key}\n${value}`);
        }
      }
      if (customParts.length > 0) {
        instructions.customInstructions = customParts.join('\n\n');
      }

      context.instructions = instructions;
      return;
    }
  }
}

/**
 * 解析 Markdown 节
 */
function parseMarkdownSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = content.split('\n');

  let currentSection = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headerMatch && headerMatch[1]) {
      // 保存上一节
      if (currentSection) {
        sections[currentSection.toLowerCase()] = currentContent.join('\n').trim();
      }
      currentSection = headerMatch[1];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // 保存最后一节
  if (currentSection) {
    sections[currentSection.toLowerCase()] = currentContent.join('\n').trim();
  }

  return sections;
}

/**
 * 提取列表项
 */
function extractListItems(content: string): string[] {
  return content.split('\n')
    .map(line => line.replace(/^[-*]\s*/, '').replace(/^`|`$/g, '').trim())
    .filter(Boolean);
}

/**
 * 检测代码风格配置（并行优化版）
 */
async function detectCodeStyle(cwd: string, context: ProjectContext): Promise<void> {
  // 并行检测 ESLint、Prettier 和 EditorConfig
  const eslintFiles = [
    '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yaml', '.eslintrc.yml',
    'eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs',
  ];
  const prettierFiles = [
    '.prettierrc', '.prettierrc.json', '.prettierrc.js', '.prettierrc.cjs',
    '.prettierrc.yaml', '.prettierrc.yml', '.prettierrc.toml', 'prettier.config.js',
  ];

  const [eslintConfig, prettierConfig, hasEditorConfig] = await Promise.all([
    findFirstExisting(cwd, eslintFiles),
    findFirstExisting(cwd, prettierFiles),
    fileExists(path.join(cwd, '.editorconfig')),
  ]);

  // ESLint
  if (eslintConfig) {
    context.codeStyle.eslint = true;
    context.codeStyle.eslintConfig = eslintConfig;
  }

  // Prettier
  if (prettierConfig) {
    context.codeStyle.prettier = true;
    context.codeStyle.prettierConfig = prettierConfig;

    // 尝试解析配置
    try {
      const content = await fs.readFile(path.join(cwd, prettierConfig), 'utf-8');
      if (prettierConfig.endsWith('.json') || prettierConfig === '.prettierrc') {
        const config = JSON.parse(content);
        context.codeStyle.semicolons = config.semi;
        context.codeStyle.quotes = config.singleQuote ? 'single' : 'double';
        context.codeStyle.indentStyle = config.useTabs ? 'tabs' : 'spaces';
        context.codeStyle.indentSize = config.tabWidth;
      }
    } catch {
      // 忽略解析错误
    }
  }

  // EditorConfig
  if (hasEditorConfig) {
    context.codeStyle.editorConfig = true;

    try {
      const content = await fs.readFile(path.join(cwd, '.editorconfig'), 'utf-8');
      const indentStyleMatch = content.match(/indent_style\s*=\s*(space|tab)/i);
      if (indentStyleMatch && indentStyleMatch[1]) {
        context.codeStyle.indentStyle = indentStyleMatch[1] === 'tab' ? 'tabs' : 'spaces';
      }
      const indentSizeMatch = content.match(/indent_size\s*=\s*(\d+)/);
      if (indentSizeMatch && indentSizeMatch[1]) {
        context.codeStyle.indentSize = parseInt(indentSizeMatch[1], 10);
      }
    } catch {
      // 忽略
    }
  }
}

/**
 * 检测 CI/CD 配置（并行优化版）
 */
async function detectCICD(cwd: string, context: ProjectContext): Promise<void> {
  // 并行检测所有 CI/CD 平台
  const cicdChecks = await Promise.all([
    fileExists(path.join(cwd, '.github', 'workflows')),
    fileExists(path.join(cwd, '.gitlab-ci.yml')),
    fileExists(path.join(cwd, 'Jenkinsfile')),
    fileExists(path.join(cwd, '.circleci', 'config.yml')),
    fileExists(path.join(cwd, '.travis.yml')),
    fileExists(path.join(cwd, 'azure-pipelines.yml')),
  ]);

  const [hasGitHubActions, hasGitLabCI, hasJenkins, hasCircleCI, hasTravis, hasAzure] = cicdChecks;

  // GitHub Actions (优先级最高)
  if (hasGitHubActions) {
    context.cicd.platform = 'github-actions';
    context.cicd.configPath = '.github/workflows';

    try {
      const ghActionsPath = path.join(cwd, '.github', 'workflows');
      const files = await fs.readdir(ghActionsPath);
      const yamlFiles = files.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));

      // 并行读取所有工作流文件
      const contents = await Promise.all(
        yamlFiles.map(file => fs.readFile(path.join(ghActionsPath, file), 'utf-8'))
      );

      for (let i = 0; i < yamlFiles.length; i++) {
        const yamlFile = yamlFiles[i];
        const content = contents[i];
        if (!yamlFile || !content) continue;

        context.cicd.workflows.push(yamlFile.replace(/\.ya?ml$/, ''));

        if (content.includes('test') || content.includes('jest') || content.includes('vitest')) {
          context.cicd.hasTests = true;
        }
        if (content.includes('deploy') || content.includes('release') || content.includes('publish')) {
          context.cicd.hasDeploy = true;
        }
        if (content.includes('lint') || content.includes('eslint')) {
          context.cicd.hasLint = true;
        }
      }
    } catch {
      // 忽略
    }
    return;
  }

  // GitLab CI
  if (hasGitLabCI) {
    context.cicd.platform = 'gitlab-ci';
    context.cicd.configPath = '.gitlab-ci.yml';
    return;
  }

  // Jenkins
  if (hasJenkins) {
    context.cicd.platform = 'jenkins';
    context.cicd.configPath = 'Jenkinsfile';
    return;
  }

  // CircleCI
  if (hasCircleCI) {
    context.cicd.platform = 'circleci';
    context.cicd.configPath = '.circleci/config.yml';
    return;
  }

  // Travis CI
  if (hasTravis) {
    context.cicd.platform = 'travis';
    context.cicd.configPath = '.travis.yml';
    return;
  }

  // Azure Pipelines
  if (hasAzure) {
    context.cicd.platform = 'azure-pipelines';
    context.cicd.configPath = 'azure-pipelines.yml';
    return;
  }
}

/**
 * 检测环境变量配置（并行优化版）
 */
async function detectEnvConfig(cwd: string, context: ProjectContext): Promise<void> {
  // 并行检测环境文件和环境类型
  const envFiles = ['.env.example', '.env.template', '.env.sample', 'env.example'];
  const envPatterns = ['.env.development', '.env.staging', '.env.production', '.env.test', '.env.local'];

  const [templateFile, existingEnvs] = await Promise.all([
    findFirstExisting(cwd, envFiles),
    filterExisting(cwd, envPatterns),
  ]);

  // 解析模板文件
  if (templateFile) {
    context.env.templateFile = templateFile;

    const content = await fs.readFile(path.join(cwd, templateFile), 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      // 跳过空行和注释
      if (!line.trim() || line.trim().startsWith('#')) continue;

      const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)/);
      if (match && match[1] && match[2] !== undefined) {
        const name = match[1];
        const value = match[2];
        const hasDefault = value.trim() !== '' && !value.includes('<') && !value.includes('your-');

        // 检查前一行是否有注释作为描述
        let description: string | undefined;
        const prevLine = lines[i - 1];
        if (i > 0 && prevLine && prevLine.trim().startsWith('#')) {
          description = prevLine.replace(/^#\s*/, '').trim();
        }

        context.env.variables.push({
          name,
          description,
          required: !hasDefault,
          hasDefault,
        });
      }
    }
  }

  // 环境类型
  context.env.environments = existingEnvs.map(e => e.replace('.env.', ''));
}

/**
 * 检测数据库配置
 */
async function detectDatabase(cwd: string, context: ProjectContext): Promise<void> {
  // Prisma
  const prismaSchemaPath = path.join(cwd, 'prisma', 'schema.prisma');
  if (await fileExists(prismaSchemaPath)) {
    context.database.orm = 'prisma';
    context.database.schemaPath = 'prisma/schema.prisma';
    context.database.migrationsPath = 'prisma/migrations';

    const content = await fs.readFile(prismaSchemaPath, 'utf-8');

    // 检测数据库类型
    const providerMatch = content.match(/provider\s*=\s*"(\w+)"/);
    if (providerMatch && providerMatch[1]) {
      const provider = providerMatch[1].toLowerCase();
      if (provider === 'postgresql' || provider === 'postgres') {
        context.database.dbType = 'postgresql';
      } else if (provider === 'mysql') {
        context.database.dbType = 'mysql';
      } else if (provider === 'sqlite') {
        context.database.dbType = 'sqlite';
      } else if (provider === 'mongodb') {
        context.database.dbType = 'mongodb';
      }
    }

    // 提取模型名称
    const modelMatches = content.matchAll(/model\s+(\w+)\s*\{/g);
    for (const match of modelMatches) {
      if (match && match[1]) {
        context.database.models.push(match[1]);
      }
    }
    return;
  }

  // Drizzle
  const drizzleConfigFiles = ['drizzle.config.ts', 'drizzle.config.js'];
  for (const file of drizzleConfigFiles) {
    if (await fileExists(path.join(cwd, file))) {
      context.database.orm = 'drizzle';
      context.database.schemaPath = file;
      return;
    }
  }

  // TypeORM
  const typeormConfigFiles = ['ormconfig.json', 'ormconfig.js', 'data-source.ts'];
  for (const file of typeormConfigFiles) {
    if (await fileExists(path.join(cwd, file))) {
      context.database.orm = 'typeorm';
      context.database.schemaPath = file;
      return;
    }
  }

  // Mongoose (MongoDB)
  if (context.dependencies.includes('mongoose')) {
    context.database.orm = 'mongoose';
    context.database.dbType = 'mongodb';
    return;
  }

  // SQLAlchemy (Python)
  if (context.type === 'python') {
    if (context.dependencies.includes('sqlalchemy')) {
      context.database.orm = 'sqlalchemy';
    } else if (context.frameworks.includes('Django')) {
      context.database.orm = 'django-orm';
    }
  }
}

/**
 * 检测 API 配置
 */
async function detectAPI(cwd: string, context: ProjectContext): Promise<void> {
  // OpenAPI/Swagger
  const openApiFiles = ['openapi.yaml', 'openapi.json', 'swagger.yaml', 'swagger.json', 'api.yaml', 'api.json'];
  for (const file of openApiFiles) {
    if (await fileExists(path.join(cwd, file))) {
      context.api.openApiPath = file;
      context.api.style = 'rest';
      break;
    }
  }

  // GraphQL
  const graphqlFiles = ['schema.graphql', 'schema.gql'];
  for (const file of graphqlFiles) {
    if (await fileExists(path.join(cwd, file))) {
      context.api.style = 'graphql';
      break;
    }
  }
  if (context.dependencies.includes('@apollo/server') ||
      context.dependencies.includes('graphql-yoga') ||
      context.dependencies.includes('type-graphql')) {
    context.api.style = 'graphql';
  }

  // tRPC
  if (context.dependencies.includes('@trpc/server')) {
    context.api.style = 'trpc';
  }

  // gRPC
  const protoFiles = await findFiles(cwd, '*.proto');
  if (protoFiles.length > 0) {
    context.api.style = 'grpc';
  }

  // Next.js API Routes
  const nextApiPath = path.join(cwd, 'pages', 'api');
  const nextAppApiPath = path.join(cwd, 'app', 'api');
  if (await fileExists(nextApiPath) || await fileExists(nextAppApiPath)) {
    context.api.style = 'rest';
    // 可以深入扫描 API 路由文件
  }

  // Express 路由检测
  if (context.frameworks.includes('Express')) {
    context.api.style = 'rest';
  }
}

/**
 * 检测测试配置（并行优化版）
 */
async function detectTesting(cwd: string, context: ProjectContext): Promise<void> {
  // 并行检测所有测试相关配置
  const jestConfigFiles = ['jest.config.js', 'jest.config.ts', 'jest.config.mjs'];
  const vitestConfigFiles = ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mts'];
  const testDirs = ['test', 'tests', '__tests__', 'spec', 'specs'];

  const [jestConfig, vitestConfig, existingTestDirs, hasPytestIni, hasPyproject] = await Promise.all([
    findFirstExisting(cwd, jestConfigFiles),
    findFirstExisting(cwd, vitestConfigFiles),
    filterExisting(cwd, testDirs),
    context.type === 'python' ? fileExists(path.join(cwd, 'pytest.ini')) : Promise.resolve(false),
    context.type === 'python' ? fileExists(path.join(cwd, 'pyproject.toml')) : Promise.resolve(false),
  ]);

  // Jest
  if (jestConfig) {
    context.testing.framework = 'jest';
    context.testing.configPath = jestConfig;
  }
  // Vitest
  else if (vitestConfig) {
    context.testing.framework = 'vitest';
    context.testing.configPath = vitestConfig;
  }
  // 从 package.json 检测
  else if (!context.testing.framework) {
    if (context.devDependencies.includes('jest')) {
      context.testing.framework = 'jest';
    } else if (context.devDependencies.includes('vitest')) {
      context.testing.framework = 'vitest';
    } else if (context.devDependencies.includes('mocha')) {
      context.testing.framework = 'mocha';
    }
  }

  // pytest
  if (context.type === 'python' && (hasPytestIni || hasPyproject)) {
    context.testing.framework = 'pytest';
  }

  // 测试目录
  context.testing.testDirs = existingTestDirs;

  // 检测覆盖率配置
  if (context.devDependencies.includes('nyc') ||
      context.devDependencies.includes('@vitest/coverage-v8') ||
      context.devDependencies.includes('@vitest/coverage-istanbul')) {
    context.testing.hasCoverage = true;
  }
}

/**
 * 检测 Docker 配置（并行优化版）
 */
async function detectDocker(cwd: string, context: ProjectContext): Promise<void> {
  // 并行检测 Dockerfile 和 docker-compose
  const dockerfiles = ['Dockerfile', 'dockerfile', 'Dockerfile.dev', 'Dockerfile.prod'];
  const composeFiles = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];

  const [dockerfile, composeFile] = await Promise.all([
    findFirstExisting(cwd, dockerfiles),
    findFirstExisting(cwd, composeFiles),
  ]);

  // Dockerfile
  if (dockerfile) {
    context.docker.dockerfile = dockerfile;

    // 检测多阶段构建
    const content = await fs.readFile(path.join(cwd, dockerfile), 'utf-8');
    const fromCount = (content.match(/^FROM\s/gm) || []).length;
    context.docker.multiStage = fromCount > 1;
  }

  // docker-compose
  if (composeFile) {
    context.docker.composePath = composeFile;

    // 提取服务名
    const content = await fs.readFile(path.join(cwd, composeFile), 'utf-8');
    let inServices = false;
    const lines = content.split('\n');
    for (const line of lines) {
      if (!line) continue;
      if (line.match(/^services:\s*$/)) {
        inServices = true;
        continue;
      }
      if (inServices && line.match(/^\w+:/) && !line.match(/^\s/)) {
        break; // 另一个顶级键
      }
      if (inServices) {
        const serviceMatch = line.match(/^  (\w[\w-]*):\s*$/);
        if (serviceMatch && serviceMatch[1]) {
          context.docker.services.push(serviceMatch[1]);
        }
      }
    }
  }
}

/**
 * 检测项目结构（并行优化版）
 */
async function detectStructure(cwd: string, context: ProjectContext): Promise<void> {
  const commonDirs = [
    'src', 'lib', 'app', 'pages', 'components', 'utils', 'hooks',
    'api', 'services', 'models', 'controllers', 'routes', 'middleware',
    'test', 'tests', '__tests__', 'spec',
    'packages', 'apps', 'libs',
    'public', 'static', 'assets',
    'config', 'configs',
    'scripts', 'tools', 'bin',
    'docs', 'documentation',
  ];

  const commonFiles = [
    'README.md', 'LICENSE', 'CHANGELOG.md', 'CONTRIBUTING.md',
    '.gitignore', '.npmignore',
    '.env', '.env.example', '.env.local',
    'Dockerfile', 'docker-compose.yml',
    'Makefile',
    '.nvmrc', '.node-version',
  ];

  // 并行检测所有目录和文件
  const [existingDirs, existingFiles] = await Promise.all([
    filterExisting(cwd, commonDirs),
    filterExisting(cwd, commonFiles),
  ]);

  context.structure = [
    ...existingDirs.map(d => d + '/'),
    ...existingFiles,
  ];
}

/**
 * 检测 Git 信息
 */
async function detectGit(cwd: string, context: ProjectContext): Promise<void> {
  // 分支
  try {
    const headPath = path.join(cwd, '.git', 'HEAD');
    if (await fileExists(headPath)) {
      const content = await fs.readFile(headPath, 'utf-8');
      const match = content.match(/ref: refs\/heads\/(.+)/);
      if (match && match[1]) {
        context.git.branch = match[1].trim();
      }
    }
  } catch {
    // 忽略
  }

  // Remote URL
  try {
    const configPath = path.join(cwd, '.git', 'config');
    if (await fileExists(configPath)) {
      const content = await fs.readFile(configPath, 'utf-8');
      const urlMatch = content.match(/url\s*=\s*(.+)/);
      if (urlMatch && urlMatch[1]) {
        context.git.remoteUrl = urlMatch[1].trim();
      }
    }
  } catch {
    // 忽略
  }
}

/**
 * 检测架构模式
 */
function detectArchitecture(context: ProjectContext): void {
  const patterns: string[] = [];

  // Monorepo
  if (context.isMonorepo) {
    patterns.push('monorepo');
  }

  // Next.js / Nuxt (JAMstack)
  if (context.frameworks.includes('Next.js') || context.frameworks.includes('Nuxt')) {
    context.architecture.type = 'jamstack';
    patterns.push('server-side-rendering');
  }

  // Serverless
  if (context.dependencies.includes('@aws-cdk/aws-lambda') ||
      context.dependencies.includes('serverless') ||
      context.dependencies.includes('@vercel/functions')) {
    context.architecture.type = 'serverless';
    patterns.push('serverless-functions');
  }

  // Clean Architecture / DDD
  if (context.structure.includes('domain/') ||
      context.structure.includes('entities/') ||
      context.structure.includes('usecases/') ||
      context.structure.includes('repositories/')) {
    context.architecture.type = 'clean-architecture';
    patterns.push('domain-driven-design');
  }

  // MVC
  if (context.structure.includes('controllers/') &&
      context.structure.includes('models/') &&
      (context.structure.includes('views/') || context.structure.includes('templates/'))) {
    context.architecture.type = 'mvc';
    patterns.push('model-view-controller');
  }

  // Microservices
  if (context.docker.services.length > 3 ||
      (context.isMonorepo && context.packages && context.packages.length > 5)) {
    patterns.push('microservices-like');
  }

  // 层次结构
  const layers: string[] = [];
  if (context.structure.includes('api/') || context.structure.includes('routes/')) {
    layers.push('presentation');
  }
  if (context.structure.includes('services/') || context.structure.includes('usecases/')) {
    layers.push('application');
  }
  if (context.structure.includes('models/') || context.structure.includes('entities/')) {
    layers.push('domain');
  }
  if (context.structure.includes('repositories/') || context.database.orm) {
    layers.push('infrastructure');
  }

  if (layers.length > 0) {
    context.architecture.layers = layers;
  }

  context.architecture.patterns = patterns;

  // 如果没有检测到特定架构
  if (context.architecture.type === 'unknown' && patterns.length === 0) {
    context.architecture.type = 'monolith';
  }
}

/**
 * 检测使用的框架
 */
function detectFrameworks(deps: Record<string, string>): string[] {
  const frameworks: string[] = [];

  const frameworkMap: Record<string, string> = {
    'react': 'React',
    'react-dom': 'React',
    'vue': 'Vue',
    '@vue/core': 'Vue',
    '@angular/core': 'Angular',
    'next': 'Next.js',
    'nuxt': 'Nuxt',
    'gatsby': 'Gatsby',
    'remix': 'Remix',
    'astro': 'Astro',
    'svelte': 'Svelte',
    '@sveltejs/kit': 'SvelteKit',
    'solid-js': 'Solid',
    'express': 'Express',
    'fastify': 'Fastify',
    'koa': 'Koa',
    'hono': 'Hono',
    '@nestjs/core': 'NestJS',
    'electron': 'Electron',
    'tauri': 'Tauri',
    'react-native': 'React Native',
    'expo': 'Expo',
    'vite': 'Vite',
    'webpack': 'Webpack',
    'esbuild': 'esbuild',
    'rollup': 'Rollup',
    'jest': 'Jest',
    'vitest': 'Vitest',
    'playwright': 'Playwright',
    'cypress': 'Cypress',
    'prisma': 'Prisma',
    '@prisma/client': 'Prisma',
    'drizzle-orm': 'Drizzle',
    'typeorm': 'TypeORM',
    'sequelize': 'Sequelize',
    'tailwindcss': 'Tailwind CSS',
    'styled-components': 'Styled Components',
    '@emotion/react': 'Emotion',
    'ink': 'Ink (CLI)',
    '@trpc/server': 'tRPC',
    '@apollo/server': 'Apollo GraphQL',
    'graphql-yoga': 'GraphQL Yoga',
    'socket.io': 'Socket.IO',
    'redis': 'Redis',
    'ioredis': 'Redis',
    'mongoose': 'Mongoose',
    'pg': 'PostgreSQL',
    'mysql2': 'MySQL',
    'better-sqlite3': 'SQLite',
  };

  for (const [dep, name] of Object.entries(frameworkMap)) {
    if (deps[dep]) {
      if (!frameworks.includes(name)) {
        frameworks.push(name);
      }
    }
  }

  return frameworks;
}

/**
 * 检查文件是否存在
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 批量检测文件存在性（并行化优化）
 * 返回第一个存在的文件路径，如果都不存在返回 null
 */
async function findFirstExisting(basePath: string, files: string[]): Promise<string | null> {
  const checks = files.map(async (file) => {
    const fullPath = path.join(basePath, file);
    return { file, exists: await fileExists(fullPath) };
  });

  const results = await Promise.all(checks);
  const found = results.find(r => r.exists);
  return found ? found.file : null;
}

/**
 * 批量检测多个文件/目录的存在性（并行化优化）
 * 返回所有存在的文件/目录列表
 */
async function filterExisting(basePath: string, items: string[]): Promise<string[]> {
  const checks = items.map(async (item) => {
    const fullPath = path.join(basePath, item);
    return { item, exists: await fileExists(fullPath) };
  });

  const results = await Promise.all(checks);
  return results.filter(r => r.exists).map(r => r.item);
}

/**
 * 简单文件查找
 */
async function findFiles(dir: string, pattern: string): Promise<string[]> {
  const files: string[] = [];
  const ext = pattern.replace('*', '');

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(ext)) {
        files.push(path.join(dir, entry.name));
      }
    }
  } catch {
    // 忽略
  }

  return files;
}

/**
 * 生成项目上下文摘要（用于添加到系统提示词）
 */
export function generateProjectSummary(context: ProjectContext): string {
  if (context.type === 'unknown') {
    return '';
  }

  const lines: string[] = ['# 当前项目信息\n'];

  // 基本信息
  if (context.name) {
    lines.push(`**项目**: ${context.name}${context.version ? ` v${context.version}` : ''}`);
  }
  lines.push(`**类型**: ${context.type.toUpperCase()}${context.isMonorepo ? ' (Monorepo)' : ''}`);

  if (context.git.branch) {
    lines.push(`**分支**: ${context.git.branch}`);
  }

  // 框架
  if (context.frameworks.length > 0) {
    lines.push(`**技术栈**: ${context.frameworks.slice(0, 10).join(', ')}`);
  }

  // 架构
  if (context.architecture.type !== 'unknown') {
    lines.push(`**架构**: ${context.architecture.type}`);
  }

  // 代码风格
  const codeStyleParts: string[] = [];
  if (context.codeStyle.eslint) codeStyleParts.push('ESLint');
  if (context.codeStyle.prettier) codeStyleParts.push('Prettier');
  if (context.codeStyle.editorConfig) codeStyleParts.push('EditorConfig');
  if (codeStyleParts.length > 0) {
    lines.push(`**代码规范**: ${codeStyleParts.join(', ')}`);
  }

  // 数据库
  if (context.database.orm) {
    lines.push(`**数据库**: ${context.database.orm}${context.database.dbType ? ` (${context.database.dbType})` : ''}`);
    if (context.database.models.length > 0) {
      lines.push(`**模型**: ${context.database.models.slice(0, 8).join(', ')}`);
    }
  }

  // API
  if (context.api.style) {
    lines.push(`**API 风格**: ${context.api.style.toUpperCase()}`);
  }

  // 测试
  if (context.testing.framework) {
    lines.push(`**测试框架**: ${context.testing.framework}`);
  }

  // CI/CD
  if (context.cicd.platform) {
    lines.push(`**CI/CD**: ${context.cicd.platform}`);
  }

  // 脚本命令
  if (Object.keys(context.scripts).length > 0) {
    const importantScripts = ['dev', 'start', 'build', 'test', 'lint', 'typecheck'];
    const availableScripts = importantScripts.filter(s => context.scripts[s]);
    if (availableScripts.length > 0) {
      lines.push(`**可用命令**: ${availableScripts.map(s => `npm run ${s}`).join(', ')}`);
    }
  }

  // 项目结构
  if (context.structure.length > 0) {
    lines.push(`**项目结构**: ${context.structure.slice(0, 10).join(', ')}`);
  }

  // Monorepo 包
  if (context.isMonorepo && context.packages && context.packages.length > 0) {
    lines.push(`**包**: ${context.packages.slice(0, 5).join(', ')}${context.packages.length > 5 ? '...' : ''}`);
  }

  // 环境变量
  if (context.env.variables.length > 0) {
    const requiredVars = context.env.variables.filter(v => v.required).map(v => v.name);
    if (requiredVars.length > 0) {
      lines.push(`**必需环境变量**: ${requiredVars.slice(0, 5).join(', ')}`);
    }
  }

  // 项目指令（LSC.md）
  if (context.instructions) {
    lines.push('\n## 项目指令 (LSC.md)\n');

    if (context.instructions.description) {
      lines.push(`**描述**: ${context.instructions.description.slice(0, 200)}`);
    }

    if (context.instructions.codeStyle) {
      lines.push(`\n**代码规范要求**:\n${context.instructions.codeStyle}`);
    }

    if (context.instructions.architecture) {
      lines.push(`\n**架构说明**:\n${context.instructions.architecture}`);
    }

    if (context.instructions.importantFiles && context.instructions.importantFiles.length > 0) {
      lines.push(`\n**重要文件**: ${context.instructions.importantFiles.join(', ')}`);
    }

    if (context.instructions.doNotEdit && context.instructions.doNotEdit.length > 0) {
      lines.push(`\n**禁止修改**: ${context.instructions.doNotEdit.join(', ')}`);
    }

    if (context.instructions.testingRequirements) {
      lines.push(`\n**测试要求**:\n${context.instructions.testingRequirements}`);
    }

    if (context.instructions.commitConventions) {
      lines.push(`\n**提交规范**:\n${context.instructions.commitConventions}`);
    }

    if (context.instructions.customInstructions) {
      lines.push(`\n**其他指令**:\n${context.instructions.customInstructions}`);
    }
  }

  return lines.join('\n');
}

/**
 * 快速检测（仅返回关键信息，用于性能优先场景）
 */
export async function detectProjectContextQuick(cwd: string): Promise<Partial<ProjectContext>> {
  const context: Partial<ProjectContext> = {
    type: 'unknown',
    frameworks: [],
    scripts: {},
    git: {},
  };

  try {
    // 仅检测 package.json
    const packageJsonPath = path.join(cwd, 'package.json');
    if (await fileExists(packageJsonPath)) {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);

      context.name = pkg.name;
      context.type = await fileExists(path.join(cwd, 'tsconfig.json')) ? 'typescript' : 'nodejs';

      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      context.frameworks = detectFrameworks(allDeps).slice(0, 5);
      context.scripts = pkg.scripts || {};
    }

    // Git 分支
    const headPath = path.join(cwd, '.git', 'HEAD');
    if (await fileExists(headPath)) {
      const content = await fs.readFile(headPath, 'utf-8');
      const match = content.match(/ref: refs\/heads\/(.+)/);
      if (match && match[1] && context.git) {
        context.git.branch = match[1].trim();
      }
    }

    // LSC.md（快速检测）
    const lscPath = path.join(cwd, 'LSC.md');
    if (await fileExists(lscPath)) {
      const content = await fs.readFile(lscPath, 'utf-8');
      context.instructions = { content };
    }

  } catch {
    // 忽略
  }

  return context;
}
