# Draft Persistence - Data Flow Diagrams

## Component Integration Map

```
┌─────────────────────────────────────────────────────────────────┐
│                    App.jsx (Routes)                             │
└────────────────────────┬──────────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────┐
            │  OnboardingGate.jsx    │ ◄── clearDraft() on VERIFIED
            │  (Auth gate wrapper)   │
            └────────────┬───────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │  OnboardingWizard.jsx          │ ◄── Core component
        │  - useOnboardingDraft()        │
        │  - useExitProtection()         │
        │  - Auto-save after each step   │
        │  - Resume banner               │
        └────────┬───────────────────────┘
                 │
        ┌────────┼─────────────────────────────────┐
        ▼        ▼        ▼        ▼       ▼        ▼
    Step1   Step2    Step3    Step4  Step5   Step6
    (Identity) (Docs) (P2P) (MoMo) (Agreement) (Submitted)
                                       │
                                       ├─► callOnSubmissionComplete()
                                       │   └─► draft.clear()
                                       │
                                       └─► normalizeAgreementResponse()
```

## Data Flow: Save

```
User fills form in Step X
        │
        ▼
formData state updated
        │
        ▼
OnboardingWizard useEffect triggers
(currentStep or formData dependency)
        │
        ▼
draft.save(currentStep, formData)
        │
        ├─► serializeFormData(formData)
        │   - Strips base64 images
        │   - Keeps text fields
        │   - Stores presence flags only
        │
        ├─► saveDraft() writes to Preferences
        │   setPreference('rowan_trader_onboarding_draft', JSON.stringify(draft))
        │
        └─► Saved to device storage
            (persists after app close)
```

## Data Flow: Restore

```
App opens → OnboardingWizard mounts
        │
        ▼
useOnboardingDraft() hook initializes
        │
        ├─► draftLoading = true (show spinner)
        │
        ├─► Check backend status
        │   getOnboardingStatus()
        │   │
        │   ├─ If VERIFIED: clearDraft() + return
        │   └─ If not VERIFIED: continue restore
        │
        ▼
loadDraft() from Preferences
        │
        ├─► getPreference('rowan_trader_onboarding_draft')
        │
        ├─► Parse & validate structure
        │   - Check: 1 ≤ currentStep ≤ 6
        │   - Check: formData is object
        │   - If invalid: clearDraft() + return null
        │
        ├─► deserializeFormData(stored)
        │   - Restores all text fields
        │   - Sets document flags (user must re-upload)
        │
        ▼
setCurrentStep(draft.currentStep)
setFormData(deserializeFormData(draft.formData))
        │
        ▼
setShowResumeBanner(true)
Resume banner renders for 5s
        │
        ├─► If docs flagged: setDocumentWarning(true)
        │   Shows: "Please re-upload your documents"
        │
        └─► setTimeout 5s: setShowResumeBanner(false)
            Banner auto-dismisses
```

## Data Flow: Submission + Clear

```
User completes Step 5 Agreement
        │
        ▼
Clicks "Submit Application"
handleSubmit() called
        │
        ├─► confirmAgreement(true, version)
        │
        ├─► Build multipart FormData
        │   - Fetch actual base64 from formData (not draft)
        │   - Include all documents
        │
        ├─► submitOnboarding(fd)
        │   (multipart POST to backend)
        │
        ▼
If success:
        │
        ├─► onSubmissionComplete() callback
        │   └─► draft.clear()
        │       └─► removePreference('rowan_trader_onboarding_draft')
        │           └─► Draft removed from device storage
        │
        ├─► goNext() → Step 6
        │   (Confirmation screen)
        │
        └─► User sees "Application Submitted"
```

## State Management Diagram

```
┌────────────────────────────────────────────────────────┐
│          OnboardingWizard Local State                  │
├────────────────────────────────────────────────────────┤
│                                                        │
│  currentStep (number 1-6)                            │
│  ├─ Saved to draft after change                      │
│  └─ Restored on mount                                │
│                                                        │
│  formData (object)                                   │
│  ├─ Accumulated across steps                         │
│  ├─ Saved (serialized) to draft after change         │
│  └─ Restored on mount                                │
│                                                        │
│  showResumeBanner (boolean)                          │
│  ├─ true if draft was restored                       │
│  └─ auto-dismiss after 5s timeout                    │
│                                                        │
│  documentWarning (boolean)                           │
│  ├─ true if documents were in draft                  │
│  └─ Shows message about re-upload                    │
│                                                        │
│  draftLoading (boolean)                              │
│  ├─ true while initializing from draft               │
│  └─ Shows spinner to user                            │
│                                                        │
└────────────────────────────────────────────────────────┘
        │
        └─► useOnboardingDraft() Hook
            ├─ loading (boolean)
            ├─ hasDraft (boolean)
            ├─ draftData (object|null)
            ├─ save(step, data) → Promise
            └─ clear() → Promise
                 │
                 └─► Device Storage (Preferences)
                     └─ rowan_trader_onboarding_draft
```

## Timeline: Resume After Exit

```
T0: User in Step 2, fills form
    ├─ formData.identity = {...}
    └─ Draft auto-saved to device

T0+5: User closes app / refreshes page

T1: User logs back in
    └─ OnboardingGate shows wizard

T1+1: OnboardingWizard mounts
      ├─ draftLoading = true (spinner shows)
      ├─ useOnboardingDraft() checks for draft
      └─ Backend status checked

T1+2: Draft found & validated
      ├─ currentStep = 2
      ├─ formData = deserialized
      ├─ draftLoading = false (spinner hides)
      └─ showResumeBanner = true

T1+3: Resume banner renders
      ├─ Message: "✓ We restored your onboarding progress"
      ├─ If docs: "Please re-upload your documents"
      └─ Step 2 content shows with form pre-filled

T1+8: Banner auto-dismisses
      └─ User continues filling form, sees all previous data

T1+X: User re-uploads documents
      ├─ Step 2 documents uploaded (new files)
      ├─ formData.documents updated
      └─ Draft auto-saved

T1+X+Y: User continues to Step 3, 4, 5
        ├─ Each step data auto-saved
        └─ Draft grows with each step

T1+X+Y+Z: User completes & submits
          ├─ onSubmissionComplete() called
          ├─ draft.clear() removes draft
          ├─ Step 6 shows confirmation
          └─ No recovery possible now (intended)
```

## Error Scenarios

```
Corrupt Draft Detected:
    ├─► loadDraft() catches error
    ├─► Logs: "Draft structure invalid"
    ├─► clearDraft() removes it
    └─► Wizard starts fresh at Step 1

Storage API Unavailable:
    ├─► setPreference() fails silently
    ├─► User continues normally
    └─► Just no persistence that session

API Status Check Fails:
    ├─► catch block logs error
    ├─► Falls back to using draft if exists
    ├─► Shows resume banner
    └─► User can continue or start over

Invalid Draft (wrong step range):
    ├─► Validation fails: currentStep not 1-6
    ├─► clearDraft() called
    └─► Start fresh

Partial/Truncated Draft JSON:
    ├─► JSON.parse() throws
    ├─► catch block handles it
    ├─► clearDraft() removes it
    └─► No data loss (just lose progress)
```

## Exit Protection Flow

```
         Step 1-5 Active
              │
              ▼
    useExitProtection(true)
    addEventListener('beforeunload')
              │
              ├─►User tries to leave
              │  ├─► Browser dialog: "Are you sure?"
              │  ├─► Options: Leave / Stay
              │  └─► If Leave: unsaved draft remains
              │      (can be resumed on next login)
              │
              └─►Step 6 or loading
                 removeEventListener('beforeunload')
                 (no warning shown)

    Step 6: Submitted
              │
              ▼
    useExitProtection(false)
    removeEventListener('beforeunload')
    (user can leave without warning)
```

## Agreement API Response Normalization

```
Backend returns:
    ├─ Option 1: { version: "1.0", content: "# Agreement" }
    ├─ Option 2: { version: "1.0", agreement: "# Agreement" }
    ├─ Option 3: { agreementVersion: "1.0", text: "# Agreement" }
    └─ Option 4: { agreementVersion: "1.0", agreement: "# Agreement" }

normalizeAgreementResponse(data)
    │
    ├─► Extract content:
    │   data.content || data.agreement || data.text || ''
    │
    ├─► Extract version:
    │   data.version || data.agreementVersion || '1.0'
    │
    └─► Return:
        { version: '1.0', content: '# Agreement' }
        (consistent structure for UI)
```

## File Sizes & Performance

```
Draft JSON Size (typical):
    ├─ currentStep: 1 byte
    ├─ identity: ~150 bytes
    ├─ binance: ~100 bytes
    ├─ momoAccounts: ~200 bytes
    └─ Total: ~500 bytes per draft
    
Load Time Impact:
    ├─ Parse draft JSON: <1ms
    ├─ Validate structure: <1ms
    ├─ Restore to state: <1ms
    └─ Total overhead: <5ms

Save Time Impact:
    ├─ Serialize formData: <1ms
    ├─ JSON.stringify: <1ms
    ├─ setPreference: varies (usually <100ms on device)
    └─ Non-blocking (async)

No impact on form rendering or step transitions.
```

---

**Diagram colors key:**
- Draft ← → Storage
- User ← → UI
- Step N → Database (backend)
- Auto ▼ = automatic/transparent
- Warning ⚠️ = user interaction may be needed
