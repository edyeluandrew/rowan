BETA TECH LABS COMPANY LIMITED
PARTNER INTEGRATION AGREEMENT
(Template)

Status: Draft commercial and legal skeleton
Version: 0.1
Date: August 2026

This template is intended for payment aggregators, utility and bill payment rails, identity vendors, and similar integration partners. It is not for end users or peer-to-peer traders. Use a non-disclosure agreement before exchanging confidential roadmaps or sandbox materials if appropriate. Counsel must complete liability, intellectual property, and data-processing annexes before execution.

Parties

Beta Tech Labs Company Limited (Rowan Party)
and
[Partner full legal name] (Partner)

1. Purpose

The Partner will provide [describe services: for example Uganda bill payment application programming interface, airtime and data top-up interface, or mobile money collection and payout] so that the Rowan Party may offer related features in its applications. Technical particulars are set out in Schedule A. Commercial fees are set out in Schedule B.

2. Definitions

API means the Partner’s documented electronic interfaces, including sandbox and production environments.

End User means a customer of the Rowan Party.

Instruction means an authenticated request by the Rowan Party to validate an account, effect a payment or top-up, or query status or balance.

Confidential Information means non-public technical or commercial information of either party.

3. Access licence

The Partner grants the Rowan Party a non-exclusive, non-transferable right to access the API for the agreed services during the term of this Agreement. Credentials are confidential. Reverse engineering beyond what is reasonably required for lawful interoperability is prohibited.

4. Partner obligations

The Partner shall provide sandbox and, after onboarding, production credentials and reasonably complete documentation; maintain availability consistent with Schedule A; execute valid Instructions and return statuses and receipts; give reasonable advance notice of material API changes (thirty days is the default for breaking changes unless Schedule A states otherwise); maintain all licences required for the payment or related services it provides; and refrain from using End User data obtained solely under this Agreement to solicit those End Users away from Rowan Party for the same product during the term, subject to counsel customisation of non-solicitation language.

5. Rowan Party obligations

The Rowan Party shall complete Partner onboarding and know-your-customer or know-your-business requirements; fund and manage any prefunded float or wallet required by the Partner; use the API only for legitimate End User Instructions; implement reconciliation and raise good-faith disputes only with evidence; and display partner or regulator notices that Partner lawfully requires.

6. Fees and settlement

Pricing appears in Schedule B. Settlement timing, currency, and method are as in Schedule B. Invoices may be issued monthly or fees may be deducted from float as agreed. Each party handles its own taxes except where law requires withholding. Fee disputes must be raised within thirty days of the relevant statement.

7. Data protection

Each party is responsible for personal data for which it is controller. Where the Partner processes End User personal data for the Rowan Party, the parties shall execute a data processing schedule covering purpose limitation (fulfilment only), security measures, retention, subprocessors, and breach notification within seventy-two hours of awareness where practicable.

8. Compliance and sanctions

Neither party shall knowingly process transactions for sanctioned persons or illegal activity. Either party may refuse a transaction for compliance reasons and will cooperate with lawful investigations.

9. Intellectual property

Each party retains its pre-existing intellectual property. No trademark licence is granted except limited nominative reference or a “powered by” acknowledgement if the parties agree in writing.

10. Confidentiality

Each party will protect the other’s Confidential Information with reasonable care for five years after disclosure (or longer for trade secrets for so long as they remain secret). Exceptions include information that is public other than by breach, independently developed, already known without duty, or required to be disclosed by law (with prior notice if legally permitted).

11. Warranties

The Partner warrants that it has authority and necessary rights to provide the API services described in Schedule A. Except as expressly stated, services are provided as available and neither party warrants continuous success of third-party telecommunications or banking networks.

12. Liability and indemnity

Except for fraud, wilful misconduct, personal injury that cannot be limited, or other non-excludable liability, each party’s aggregate liability under this Agreement is limited to fees paid under this Agreement in the twelve months before the claim. The Partner shall indemnify the Rowan Party against third-party claims arising from the Partner providing services without required payment licences. Additional indemnities may be added by counsel.

13. Term and termination

The initial term is twelve months and renews automatically for successive twelve-month periods unless either party gives sixty days’ written notice before the end of the then-current term. Either party may terminate for material breach if uncured within fifteen days of notice. Either party may terminate immediately for insolvency, loss of a required licence, or sanctions prohibition. On termination, the parties shall settle float, revoke credentials, and return or destroy Confidential Information on request.

14. Governing law

This Agreement is governed by the laws of the Republic of Uganda. The courts of [Kampala] have jurisdiction unless the parties adopt an arbitration schedule.

Schedule A. Application programming interface and operations (to complete with Partner)

Current Uganda utility launch (illustrative — complete with the live Partner). Rowan uses the Partner for airtime, data, Yaka / electricity, water, and other supported bill payments. Users pay in USDC on Rowan; the Partner fulfils in UGX or tokens from Rowan’s prefunded Partner wallet. Collect and send (customer mobile money collection or disbursement for USDC conversion) are out of scope unless the parties add them in writing.

Sandbox base address: ______________________________
Production base address: ______________________________
Authentication method: ______________________________
Products enabled: airtime / data / bills (list billers) ______________________________
Biller or operator coverage and service levels: ______________________________
Webhooks, signatures, and retry policy: ______________________________
Status and error codes; idempotency: ______________________________
Support contacts and severity response times: ______________________________
Change management process: ______________________________
Prefunded float currency and top-up method: ______________________________

Schedule B. Fees (to complete with Partner quote)

Product: ________________ Fee: ________________ Settlement: ________________

Signature

For Beta Tech Labs Company Limited

Name: ______________________________
Title: ______________________________
Date: ______________________________
Signature: ______________________________

For the Partner

Name: ______________________________
Title: ______________________________
Date: ______________________________
Signature: ______________________________
Legal name of Partner: ______________________________
Company registration number: ______________________________
Registered address: ______________________________