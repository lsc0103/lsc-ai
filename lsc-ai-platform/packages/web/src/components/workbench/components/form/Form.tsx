/**
 * Workbench Form 表单组件
 *
 * 基于 Ant Design Form 实现
 * - 支持多种字段类型
 * - 表单验证
 * - 提交动作触发
 */

import React, { useCallback, useEffect } from 'react';
import {
  Form as AntForm,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Checkbox,
  Radio,
  Button,
} from 'antd';
import clsx from 'clsx';
import type { FormSchema, FormField } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';
import { useFormValues, useActionContext } from '../../context';

const { TextArea } = Input;

// ============================================================================
// 字段渲染器
// ============================================================================

interface FieldRendererProps {
  field: FormField;
}

const FieldRenderer: React.FC<FieldRendererProps> = ({ field }) => {
  const commonProps = {
    placeholder: field.placeholder,
    disabled: field.disabled,
  };

  switch (field.type) {
    case 'input':
      return <Input {...commonProps} />;

    case 'textarea':
      return <TextArea {...commonProps} rows={4} />;

    case 'number':
      return <InputNumber {...commonProps} style={{ width: '100%' }} />;

    case 'select':
      return (
        <Select {...commonProps} options={field.options} allowClear />
      );

    case 'date':
      return <DatePicker {...commonProps} style={{ width: '100%' }} />;

    case 'checkbox':
      return <Checkbox disabled={field.disabled}>{field.label}</Checkbox>;

    case 'radio':
      return (
        <Radio.Group disabled={field.disabled}>
          {field.options?.map((opt) => (
            <Radio key={String(opt.value)} value={opt.value}>
              {opt.label}
            </Radio>
          ))}
        </Radio.Group>
      );

    default:
      return <Input {...commonProps} />;
  }
};

// ============================================================================
// 主组件
// ============================================================================

export const Form: React.FC<WorkbenchComponentProps<FormSchema>> = ({ schema }) => {
  const {
    id = 'form',
    fields,
    submitText = '提交',
    onSubmitAction,
    layout = 'vertical',
    style,
    className,
  } = schema;

  const [form] = AntForm.useForm();
  const { values, setValues, resetForm } = useFormValues(id);
  const { executeAction } = useActionContext(id, 'Form');

  // 初始化表单默认值
  useEffect(() => {
    const initialValues: Record<string, unknown> = {};
    fields.forEach((field) => {
      if (field.defaultValue !== undefined) {
        initialValues[field.name] = field.defaultValue;
      }
    });

    if (Object.keys(initialValues).length > 0) {
      form.setFieldsValue(initialValues);
      setValues(initialValues);
    }
  }, [fields, form, setValues]);

  // 同步表单值变化
  const handleValuesChange = useCallback(
    (_changedValues: Record<string, unknown>, allValues: Record<string, unknown>) => {
      setValues(allValues);
    },
    [setValues]
  );

  // 提交处理
  const handleSubmit = useCallback(
    async (formValues: Record<string, unknown>) => {
      console.log('[Form] 提交表单:', formValues);

      if (onSubmitAction) {
        await executeAction(onSubmitAction, { formValues });
      }
    },
    [onSubmitAction, executeAction]
  );

  // 重置处理
  const handleReset = useCallback(() => {
    form.resetFields();
    resetForm();
  }, [form, resetForm]);

  return (
    <div
      className={clsx(
        'workbench-form',
        'p-4 rounded-lg',
        'border border-[var(--border-light)]',
        'bg-[var(--glass-bg-light)]',
        className
      )}
      style={style}
    >
      <AntForm
        form={form}
        layout={layout}
        onFinish={handleSubmit}
        onValuesChange={handleValuesChange}
        initialValues={values}
      >
        {fields.map((field) => (
          <AntForm.Item
            key={field.name}
            name={field.name}
            label={field.type !== 'checkbox' ? field.label : undefined}
            rules={
              field.required
                ? [{ required: true, message: `请填写${field.label}` }]
                : undefined
            }
            valuePropName={field.type === 'checkbox' ? 'checked' : 'value'}
          >
            <FieldRenderer field={field} />
          </AntForm.Item>
        ))}

        <AntForm.Item>
          <div className="flex gap-2">
            <Button type="primary" htmlType="submit">
              {submitText}
            </Button>
            <Button onClick={handleReset}>重置</Button>
          </div>
        </AntForm.Item>
      </AntForm>
    </div>
  );
};

Form.displayName = 'WorkbenchForm';
