import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import StepIndicator from '../../components/onboarding/StepIndicator';
import Step1_Identity from './steps/Step1_Identity';
import Step2_Documents from './steps/Step2_Documents';
import Step3_BinanceHistory from './steps/Step3_BinanceHistory';
import Step4_MomoAccounts from './steps/Step4_MomoAccounts';
import Step5_Agreement from './steps/Step5_Agreement';
import Step6_Submitted from './steps/Step6_Submitted';
import { useOnboardingDraft } from '../../hooks/useOnboardingDraft';
import { getOnboardingStatus } from '../../api/onboarding';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useExitProtection } from '../../utils/exitProtection';

/**
 * OnboardingWizard — multi-step onboarding container.
 * Manages step state + draft persistence.
 *
 * Features:
 *   - Auto-saves progress after each step
 *   - Restores previous progress on mount
 *   - Clears draft on successful submission or if status already VERIFIED
 *   - Handles draft restoration with clear user messaging
 */
export default function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({});
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [documentWarning, setDocumentWarning] = useState(false);
  const [draftLoading, setDraftLoading] = useState(true);

  const draft = useOnboardingDraft();

  // Warn before exit if in progress (not submitted, not loading)
  useExitProtection(currentStep < 6 && !draftLoading);

  // Initialize from draft on mount
  useEffect(() => {
    (async () => {
      try {
        // Check backend status first
        const statusData = await getOnboardingStatus();
        const status = statusData.status || statusData;

        // If already VERIFIED, clear any stale draft and start fresh
        if (status === 'VERIFIED') {
          await draft.clear();
          setDraftLoading(false);
          return;
        }

        // If draft exists and valid, restore it
        if (draft.draftData) {
          setCurrentStep(draft.draftData.currentStep);
          setFormData(draft.draftData.formData);
          setShowResumeBanner(true);

          // Warn user if documents couldn't be restored
          if (
            draft.draftData.formData.documents &&
            (draft.draftData.formData.documents.idFront_exists ||
              draft.draftData.formData.documents.idBack_exists ||
              draft.draftData.formData.documents.selfie_exists)
          ) {
            setDocumentWarning(true);
          }

          // Auto-dismiss banner after 5 seconds
          setTimeout(() => setShowResumeBanner(false), 5000);
        }
      } catch (err) {
        console.error('[Onboarding] Failed to initialize from draft:', err);
        // On error, start fresh
      } finally {
        setDraftLoading(false);
      }
    })();
  }, [draft.draftData]); // Re-run only if draftData changes

  // Auto-save draft after step changes
  useEffect(() => {
    if (currentStep < 6) {
      draft.save(currentStep, formData);
    }
  }, [currentStep, formData, draft]);

  const goNext = () => {
    const nextStep = Math.min(currentStep + 1, 6);
    setCurrentStep(nextStep);
  };

  const goBack = () => {
    const prevStep = Math.max(currentStep - 1, 1);
    setCurrentStep(prevStep);
  };

  const isSubmitted = currentStep === 6;

  // Handle successful submission: clear draft
  const handleSubmissionComplete = async () => {
    await draft.clear();
  };

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
        return <Step5_Agreement formData={formData} goNext={goNext} onSubmissionComplete={handleSubmissionComplete} />;
      case 6:
        return <Step6_Submitted />;
      default:
        return null;
    }
  };

  if (draftLoading) {
    return (
      <div className="bg-rowan-bg min-h-screen flex items-center justify-center">
        <LoadingSpinner size={32} className="text-rowan-yellow" />
      </div>
    );
  }

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

      {/* Resume banner */}
      {showResumeBanner && (
        <div className="fixed top-14 left-0 right-0 z-30 bg-rowan-green/15 border-b border-rowan-green/30 px-4 py-3">
          <p className="text-rowan-green text-sm text-center">
            ✓ We restored your onboarding progress.
            {documentWarning && ' Please re-upload your documents to continue.'}
          </p>
        </div>
      )}

      {/* Content area */}
      <div className={`${showResumeBanner ? 'pt-32' : 'pt-16'} pb-8 px-4 transition-all`}>
        {/* Step indicator — hidden on step 6 */}
        {!isSubmitted && (
          <StepIndicator currentStep={currentStep} totalSteps={5} />
        )}
        {renderStep()}
      </div>
    </div>
  );
}
