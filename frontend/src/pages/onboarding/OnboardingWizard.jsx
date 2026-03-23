import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import StepIndicator from '../../components/onboarding/StepIndicator';
import Step1_Identity from './steps/Step1_Identity';
import Step2_Documents from './steps/Step2_Documents';
import Step3_BinanceHistory from './steps/Step3_BinanceHistory';
import Step4_MomoAccounts from './steps/Step4_MomoAccounts';
import Step5_Agreement from './steps/Step5_Agreement';
import Step6_Submitted from './steps/Step6_Submitted';

/**
 * OnboardingWizard — multi-step onboarding container.
 * Manages step state in memory (no deep-linking).
 */
export default function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({});

  const goNext = () => setCurrentStep((s) => Math.min(s + 1, 6));
  const goBack = () => setCurrentStep((s) => Math.max(s - 1, 1));

  const isSubmitted = currentStep === 6;

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1_Identity formData={formData} setFormData={setFormData} goNext={goNext} />;
      case 2:
        return <Step2_Documents formData={formData} setFormData={setFormData} goNext={goNext} />;
      case 3:
        return <Step3_BinanceHistory formData={formData} setFormData={setFormData} goNext={goNext} />;
      case 4:
        return <Step4_MomoAccounts formData={formData} setFormData={setFormData} goNext={goNext} />;
      case 5:
        return <Step5_Agreement formData={formData} goNext={goNext} />;
      case 6:
        return <Step6_Submitted />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-rowan-bg min-h-screen">
      {/* Fixed top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-rowan-bg border-b border-rowan-border px-4 py-3 flex items-center">
        {/* Back arrow — hidden on step 1 and step 6 */}
        <div className="w-8">
          {currentStep > 1 && !isSubmitted && (
            <button onClick={goBack} className="text-rowan-text">
              <ChevronLeft size={22} />
            </button>
          )}
        </div>

        {/* Center: ROWAN */}
        <div className="flex-1 text-center">
          <span className="text-rowan-yellow font-bold tracking-widest text-base">ROWAN</span>
        </div>

        {/* Step counter — hidden on step 6 */}
        <div className="w-14 text-right">
          {!isSubmitted && (
            <span className="text-rowan-muted text-sm">{currentStep} of 5</span>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="pt-16 pb-8 px-4">
        {/* Step indicator — hidden on step 6 */}
        {!isSubmitted && (
          <StepIndicator currentStep={currentStep} totalSteps={5} />
        )}
        {renderStep()}
      </div>
    </div>
  );
}
