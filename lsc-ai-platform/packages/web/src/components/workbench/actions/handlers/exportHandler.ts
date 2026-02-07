/**
 * Export 动作处理器
 *
 * 处理 type: 'export' 的动作
 * 支持导出为 Excel、CSV、PDF、JSON、PNG、SVG 格式
 */

import type { WorkbenchAction } from '../../schema/types';
import type { ActionContext, ActionResult, IActionHandler } from '../types';
import * as XLSX from 'xlsx';

/**
 * Export 动作处理器
 */
export class ExportActionHandler implements IActionHandler {
  async handle(
    action: WorkbenchAction,
    context: ActionContext
  ): Promise<ActionResult> {
    // 验证动作类型
    if (action.type !== 'export') {
      return {
        success: false,
        error: '动作类型不是 export',
      };
    }

    // 验证导出格式
    const format = action.format || 'json';
    const filename = action.filename || `export-${Date.now()}`;

    // 获取要导出的数据
    let data = context.data?.exportData || context.data?.selectedRows || context.data;

    if (!data) {
      return {
        success: false,
        error: '没有可导出的数据',
      };
    }

    console.log('[ExportHandler] 导出数据:', { format, filename, dataType: typeof data });

    try {
      switch (format) {
        case 'excel':
          return this.exportExcel(data, filename);
        case 'csv':
          return this.exportCSV(data, filename);
        case 'json':
          return this.exportJSON(data, filename);
        case 'pdf':
          return this.exportPDF(data, filename);
        case 'png':
        case 'svg':
          return this.exportImage(format, filename, context);
        default:
          return {
            success: false,
            error: `不支持的导出格式: ${format}`,
          };
      }
    } catch (error) {
      console.error('[ExportHandler] 导出失败:', error);
      return {
        success: false,
        error: `导出失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 导出为 Excel
   */
  private exportExcel(data: unknown, filename: string): ActionResult {
    try {
      // 确保数据是数组
      const rows = Array.isArray(data) ? data : [data];

      // 创建工作表
      const worksheet = XLSX.utils.json_to_sheet(rows);

      // 自动调整列宽
      const colWidths = this.calculateColumnWidths(rows);
      worksheet['!cols'] = colWidths;

      // 创建工作簿
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

      // 使用 XLSX.write + downloadBlob（受控下载）
      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      const safeName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
      this.downloadBlob(blob, safeName);

      return {
        success: true,
        data: { filename: safeName, rows: rows.length },
      };
    } catch (error) {
      return {
        success: false,
        error: `Excel 导出失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 导出为 CSV
   */
  private exportCSV(data: unknown, filename: string): ActionResult {
    try {
      const rows = Array.isArray(data) ? data : [data];

      // 创建工作表并转换为 CSV
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const csv = XLSX.utils.sheet_to_csv(worksheet);

      // 添加 BOM 以支持中文
      const bom = '\uFEFF';
      const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });

      // 下载文件
      this.downloadBlob(blob, `${filename}.csv`);

      return {
        success: true,
        data: { filename: `${filename}.csv`, rows: rows.length },
      };
    } catch (error) {
      return {
        success: false,
        error: `CSV 导出失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 导出为 JSON
   */
  private exportJSON(data: unknown, filename: string): ActionResult {
    try {
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });

      this.downloadBlob(blob, `${filename}.json`);

      return {
        success: true,
        data: { filename: `${filename}.json` },
      };
    } catch (error) {
      return {
        success: false,
        error: `JSON 导出失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 导出为 PDF
   * 注意：完整的 PDF 导出需要额外的库（如 jsPDF）
   * 这里提供基础实现
   */
  private exportPDF(data: unknown, filename: string): ActionResult {
    try {
      // 简单实现：将数据转换为 HTML 并打印
      const rows = Array.isArray(data) ? data : [data];

      // 构建 HTML 表格
      let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${filename}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f5f5f5; }
            tr:nth-child(even) { background: #fafafa; }
          </style>
        </head>
        <body>
          <h2>${filename}</h2>
          <p>导出时间: ${new Date().toLocaleString()}</p>
      `;

      if (rows.length > 0 && typeof rows[0] === 'object') {
        const headers = Object.keys(rows[0] as object);
        html += '<table><thead><tr>';
        headers.forEach((h) => {
          html += `<th>${h}</th>`;
        });
        html += '</tr></thead><tbody>';

        rows.forEach((row) => {
          html += '<tr>';
          headers.forEach((h) => {
            const value = (row as Record<string, unknown>)[h];
            html += `<td>${value ?? ''}</td>`;
          });
          html += '</tr>';
        });

        html += '</tbody></table>';
      } else {
        html += `<pre>${JSON.stringify(data, null, 2)}</pre>`;
      }

      html += '</body></html>';

      // 打开新窗口并打印
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        return {
          success: false,
          error: '浏览器弹窗被阻止，请允许弹窗后重试',
        };
      }
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();

      return {
        success: true,
        data: { filename: `${filename}.pdf`, method: 'print' },
      };
    } catch (error) {
      return {
        success: false,
        error: `PDF 导出失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 导出图表为图片
   */
  private exportImage(
    format: 'png' | 'svg',
    filename: string,
    context: ActionContext
  ): ActionResult {
    try {
      // 从上下文获取 ECharts 实例
      const chartInstance = context.data?.chartInstance as any;

      if (!chartInstance) {
        return {
          success: false,
          error: '未找到图表实例，无法导出图片',
        };
      }

      // 获取图表的 Data URL
      const dataUrl = chartInstance.getDataURL({
        type: format,
        pixelRatio: 2,
        backgroundColor: '#fff',
      });

      // 创建下载链接
      const link = document.createElement('a');
      link.download = `${filename}.${format}`;
      link.href = dataUrl;
      link.click();

      return {
        success: true,
        data: { filename: `${filename}.${format}` },
      };
    } catch (error) {
      return {
        success: false,
        error: `图片导出失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 计算列宽
   */
  private calculateColumnWidths(rows: unknown[]): Array<{ wch: number }> {
    if (rows.length === 0) return [];

    const firstRow = rows[0] as Record<string, unknown>;
    const headers = Object.keys(firstRow);

    return headers.map((header) => {
      // 计算该列的最大宽度
      let maxWidth = header.length;

      rows.forEach((row) => {
        const value = (row as Record<string, unknown>)[header];
        const strValue = value != null ? String(value) : '';
        // 中文字符按 2 个字符宽度计算
        const width = strValue.split('').reduce((acc, char) => {
          return acc + (char.charCodeAt(0) > 127 ? 2 : 1);
        }, 0);
        maxWidth = Math.max(maxWidth, width);
      });

      return { wch: Math.min(maxWidth + 2, 50) }; // 最大宽度限制为 50
    });
  }

  /**
   * 下载 Blob 文件
   * BUG-2 fix: 使用 setTimeout 延迟触发下载，防止同步 click 事件干扰 React 状态
   */
  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    // 延迟执行下载，防止 anchor click 在 React 事件循环中干扰 UI 状态
    setTimeout(() => {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // 延迟释放 blob URL，确保浏览器已开始处理下载
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 0);
  }
}

/**
 * 创建 Export 处理器实例
 */
export const exportHandler = new ExportActionHandler();
