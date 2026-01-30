/**
 * 跨平台路径工具
 *
 * 支持 Windows 和 Linux/Unix 系统之间的路径转换
 */

import * as path from 'path';

/**
 * 检测当前操作系统
 */
export const isWindows = process.platform === 'win32';
export const isLinux = process.platform === 'linux';
export const isMacOS = process.platform === 'darwin';
export const isUnixLike = isLinux || isMacOS;

/**
 * 将 Windows 路径转换为 Unix 风格路径（用于 bash 命令）
 *
 * 示例:
 * - D:\path\to\file -> /d/path/to/file
 * - C:\Users\name -> /c/Users/name
 * - /already/unix/path -> /already/unix/path
 *
 * @param windowsPath Windows 格式路径或任意路径
 * @returns Unix 风格的路径
 */
export function toUnixPath(windowsPath: string): string {
  if (!windowsPath) return windowsPath;

  // 如果已经是 Unix 风格路径，直接返回
  if (windowsPath.startsWith('/') && !windowsPath.match(/^\/[a-zA-Z]\//)) {
    // 可能是 /d/... 这种格式，保持不变
    return windowsPath;
  }

  // 检测 Windows 盘符格式 (D:\... 或 D:/...)
  const driveLetterMatch = windowsPath.match(/^([a-zA-Z]):[\\\/]/);

  if (driveLetterMatch) {
    const driveLetter = driveLetterMatch[1].toLowerCase();
    // 移除盘符部分并转换反斜杠
    const restPath = windowsPath.slice(2).replace(/\\/g, '/');
    return `/${driveLetter}${restPath}`;
  }

  // 只需要转换反斜杠
  return windowsPath.replace(/\\/g, '/');
}

/**
 * 将 Unix 风格路径转换为 Windows 路径
 *
 * 示例:
 * - /d/path/to/file -> D:\path\to\file
 * - /c/Users/name -> C:\Users\name
 * - D:\already\windows\path -> D:\already\windows\path
 *
 * @param unixPath Unix 风格路径或任意路径
 * @returns Windows 格式的路径
 */
export function toWindowsPath(unixPath: string): string {
  if (!unixPath) return unixPath;

  // 如果已经是 Windows 路径，直接返回
  if (unixPath.match(/^[a-zA-Z]:[\\\/]/)) {
    return unixPath;
  }

  // 检测 /d/... 格式的路径
  const unixDriveMatch = unixPath.match(/^\/([a-zA-Z])\//);

  if (unixDriveMatch) {
    const driveLetter = unixDriveMatch[1].toUpperCase();
    // 移除盘符部分并转换斜杠
    const restPath = unixPath.slice(2).replace(/\//g, '\\');
    return `${driveLetter}:${restPath}`;
  }

  // 如果不是绝对路径格式，只转换斜杠
  return unixPath.replace(/\//g, '\\');
}

/**
 * 获取适合当前平台的路径格式
 *
 * @param inputPath 输入路径
 * @returns 当前平台的路径格式
 */
export function toPlatformPath(inputPath: string): string {
  if (isWindows) {
    return toWindowsPath(inputPath);
  }
  return toUnixPath(inputPath);
}

/**
 * 获取适合 bash 命令的路径格式
 * 无论在哪个平台，bash 命令都使用 Unix 风格路径
 *
 * @param inputPath 输入路径
 * @returns Unix 风格路径（用于 bash 命令）
 */
export function toBashPath(inputPath: string): string {
  return toUnixPath(inputPath);
}

/**
 * 转换 bash 命令中的所有 Windows 路径为 Unix 风格
 *
 * 这个函数会查找命令中的 Windows 路径并转换它们
 * 支持的模式:
 * - cd D:\path\to\dir
 * - cat "D:\path\to\file"
 * - /path D:\path
 *
 * @param command bash 命令
 * @returns 转换后的命令
 */
export function convertPathsInCommand(command: string): string {
  if (!command) return command;

  // 匹配 Windows 路径模式: D:\... 或 D:/...
  // 支持在引号内或引号外
  const windowsPathPattern = /([a-zA-Z]):[\\\/]([^\s"'`;|&<>]*)/g;

  return command.replace(windowsPathPattern, (match, driveLetter: string, restPath: string) => {
    // 转换为 Unix 风格
    const unixRestPath = restPath.replace(/\\/g, '/');
    return `/${driveLetter.toLowerCase()}/${unixRestPath}`;
  });
}

/**
 * 规范化路径（跨平台安全）
 *
 * @param inputPath 输入路径
 * @returns 规范化后的绝对路径
 */
export function normalizePath(inputPath: string): string {
  // 先转换为平台原生格式
  const platformPath = toPlatformPath(inputPath);

  // 使用 Node.js path 模块规范化
  if (path.isAbsolute(platformPath)) {
    return path.normalize(platformPath);
  }

  return path.resolve(process.cwd(), platformPath);
}

/**
 * 检查路径是否是 Windows 格式
 */
export function isWindowsPath(inputPath: string): boolean {
  return /^[a-zA-Z]:[\\\/]/.test(inputPath);
}

/**
 * 检查路径是否是 Unix 风格的驱动器路径 (/d/...)
 */
export function isUnixDrivePath(inputPath: string): boolean {
  return /^\/[a-zA-Z]\//.test(inputPath);
}

/**
 * 获取路径中的驱动器字母（如果有）
 *
 * @param inputPath 输入路径
 * @returns 驱动器字母（大写）或 null
 */
export function getDriveLetter(inputPath: string): string | null {
  // Windows 格式: D:\...
  const winMatch = inputPath.match(/^([a-zA-Z]):[\\\/]/);
  if (winMatch) {
    return winMatch[1].toUpperCase();
  }

  // Unix 风格: /d/...
  const unixMatch = inputPath.match(/^\/([a-zA-Z])\//);
  if (unixMatch) {
    return unixMatch[1].toUpperCase();
  }

  return null;
}

/**
 * 连接路径片段（跨平台安全）
 */
export function joinPaths(...paths: string[]): string {
  return path.join(...paths);
}

/**
 * 获取路径的父目录
 */
export function getParentDir(inputPath: string): string {
  return path.dirname(inputPath);
}

/**
 * 获取路径的文件名
 */
export function getFileName(inputPath: string): string {
  return path.basename(inputPath);
}

/**
 * 获取路径的扩展名
 */
export function getExtension(inputPath: string): string {
  return path.extname(inputPath);
}
