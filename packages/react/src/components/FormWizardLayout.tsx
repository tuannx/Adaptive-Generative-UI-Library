import React from 'react';
import { Steps, Button, Space } from 'antd';
import type { FormInstance } from 'antd';
import type { AgulWizardConfig } from '../plugins/types.js';

interface FormWizardLayoutProps {
  wizard: AgulWizardConfig;
  form: FormInstance;
  loading: boolean;
  isEdit: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  children: (activeFields: Set<string>) => React.ReactNode;
}

export function FormWizardLayout({
  wizard,
  form,
  loading,
  isEdit,
  onSubmit,
  onCancel,
  children,
}: FormWizardLayoutProps) {
  const [currentStep, setCurrentStep] = React.useState(0);
  const isLastStep = currentStep === wizard.steps.length - 1;
  const activeStep = wizard.steps[currentStep];
  const activeFields = React.useMemo(
    () => new Set(activeStep?.fields ?? []),
    [activeStep],
  );

  const goNext = async () => {
    try {
      await form.validateFields([...activeFields]);
      setCurrentStep((step) => Math.min(step + 1, wizard.steps.length - 1));
    } catch {
      // validation errors are shown by antd
    }
  };

  const goBack = () => {
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  return (
    <div data-testid="agul-form-wizard">
      <Steps
        current={currentStep}
        items={wizard.steps.map((step) => ({
          title: step.title,
          description: step.description,
        }))}
        style={{ marginBottom: 24 }}
      />

      {children(activeFields)}

      <Space style={{ marginTop: 16 }}>
        {currentStep > 0 ? (
          <Button data-testid="agul-wizard-back" onClick={goBack}>
            Back
          </Button>
        ) : null}
        {!isLastStep ? (
          <Button type="primary" data-testid="agul-wizard-next" onClick={goNext}>
            Next
          </Button>
        ) : (
          <Button
            type="primary"
            data-testid="agul-form-submit"
            loading={loading}
            onClick={onSubmit}
          >
            {isEdit ? 'Update' : 'Create'}
          </Button>
        )}
        <Button onClick={onCancel}>Cancel</Button>
      </Space>
    </div>
  );
}
