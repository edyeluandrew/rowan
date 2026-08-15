ROWAN AND MARZPAY
Integration Questions

Borderless Value. Local Payouts.

Prepared by: Rowan
Prepared for: MarzPay, Marz Innovations Limited
Date: 14 August 2026
Status: Confidential discussion draft
Contact: Edyelu Andrew, Founder. Phone +256 764 331 334. Email edyeluandrew1@gmail.com


CONTEXT

Rowan already uses MarzPay in production for bill payments and for Uganda airtime and data.
That integration works well and we are happy with it.

We now want to evaluate the MarzPay Send Money and Collections APIs so we can automate our
cash-out and cash-in flows.

Today those flows run on a human peer-to-peer trader network. When a user cashes out, we hold
their USDC in escrow, match them with a trader, and that trader manually sends mobile money to
the user. The USDC is released only once the user confirms the money arrived. Automating that
leg would remove four separate human steps, our trader matching engine, per-trader float
accounting, payout timeouts and rematch handling. It would also make payouts faster and far more
predictable for users.

We have already read your public documentation covering Send Money, Collections, Webhooks,
Security, Transaction Details and the Kenya M-Pesa guide, so this document does not ask you to
repeat anything published there. The questions below are the items your documentation does not
answer, or that depend on how our specific account is configured.

Seven questions are marked "Priority". Those are the ones that determine whether we can build
this at all. If it is easier to answer only those first, that is genuinely useful to us and we
can pick up the rest afterwards.


SECTION 1. LIQUIDITY AND PRE-FUNDING

This is our most important question.

Your team told us that float is not a problem for MarzPay. We want to understand precisely what
that means, because it is the main reason we would move away from a trader network.

Today every one of our traders must declare and maintain their own mobile money balance, and our
matching engine refuses any trader who cannot cover the order in front of them. If MarzPay holds
the liquidity instead, that entire layer disappears from our system. However, your Send Money
guide advises checking the account balance before sending, which suggests we would fund a MarzPay
balance in advance.

1. To disburse, must Rowan pre-fund a MarzPay wallet, or does MarzPay extend a float or credit
   line and settle with us afterwards? (Priority)

2. If pre-funding is required, how do we top up, what is the settlement time for a top-up, and is
   there a minimum balance we must hold?

3. Can money received through Collections automatically fund the balance we disburse from? In
   other words, if our users buy USDC from us and pay by mobile money, does that incoming balance
   become available for outgoing payouts, so the two directions offset each other?

4. Is there an API to read our current balance and available headroom? We need this so we can
   route an order to our trader network before accepting something we cannot pay out.

5. Do you offer low balance alerts, or a notification when the balance crosses a threshold we set?

6. What happens to a disbursement request if our balance is insufficient? Is it rejected
   immediately at request time, or queued until funds arrive?

7. Is there a daily or monthly total disbursement ceiling on our account, separate from the
   per-transaction limit?


SECTION 2. ACCOUNT ENABLEMENT AND THE SERVICE MARKETPLACE

Your dashboard marketplace lists MTN Collection, Airtel Collection, MTN Disbursement and Airtel
Disbursement as four separately subscribable Uganda services, each shown as Free.

8. Do we need to subscribe to each of those four services individually before the APIs will
   accept our requests, and can you enable them on our account? (Priority)

9. Regarding the word Free. Does that mean free to subscribe with a per-transaction fee charged
   separately, or genuinely no cost at all? Section 4 covers pricing in more detail.

10. Is our existing account, currently used for bills and airtime, the same account we would use
    for disbursements, or do disbursements require a separate business account or a higher
    verification tier?

11. Can you issue sandbox credentials that exercise the real request, response and webhook path?
    Your documentation describes sandbox as returning an immediate dummy success with the status
    set to sandbox. We also need to test failure cases, which Section 6 covers. (Priority)

12. What is the process and expected timeline to move from sandbox to live for disbursements?

Withdrawal phone number allowlist

Your Send Money guide describes an optional withdrawal phone numbers feature, and notes that if
it is configured, money can only be sent to those registered numbers.

13. Please confirm in writing that our account will have no withdrawal phone allowlist configured,
    and that it cannot be switched on accidentally. We pay out to end-user phone numbers that are
    different on every transaction, so an allowlist would cause every payout to fail. (Priority)


SECTION 3. LIMITS

Your documentation states 500 to 10,000,000 UGX per transaction for both collections and
disbursements.

14. Are those the same limits on our account, and do they apply per transaction, per day, or both?

15. Above 10,000,000 UGX we would fall back to our trader network. Can that ceiling be raised, and
    what would you need from us in order to do so, such as volume history, verification documents
    or a security review?

16. Are there velocity limits, meaning a maximum number of transactions per second, minute or hour,
    that we should rate-limit against on our side?

17. Do recipient mobile money limits ever cause a payout to fail after your API has already
    accepted it? If so, is that returned as a distinct error code we can act on?


SECTION 4. PRICING AND COMMERCIAL TERMS

We need a written fee schedule before any real-money pilot.

18. What is the fee per disbursement, and is it fixed, a percentage, or tiered by volume? Does it
    differ between MTN and Airtel? (Priority)

19. What is the fee per collection, and who bears it, Rowan or the paying customer?

20. Is the fee deducted from our balance, or added on top of the transfer amount? This directly
    affects our pricing, because we must show the user an exact net figure before they commit.

21. Are any fees charged on failed or reversed transactions?

22. Is there a setup fee, a monthly minimum, or a volume commitment?

23. What volume discount tiers exist, and at what monthly volume do they start?

24. Do you apply any foreign exchange spread? Our settlement asset is USDC on Stellar and we
    handle US dollar to shilling pricing ourselves, so we expect shillings in and shillings out
    with no currency conversion on your side. Please confirm.

25. Is there a fee report or account statement, by API or file, that we can reconcile against
    daily?


SECTION 5. TECHNICAL INTEGRATION

We would add MarzPay as a provider behind the country-aware payment routing layer we have already
built, alongside our trader network, so we can route by corridor and fail over automatically.

Idempotency and references

Your documentation requires the reference field to be a version 4 UUID, unique, and never reused.

26. If we retry a request using the same UUID reference after a network timeout, do you return the
    original transaction, or reject it as a duplicate? This is critical for us. We must never pay
    a user twice because a response was lost in transit.

27. If a request times out with no response at all, what is the safe recovery procedure? Is there
    a lookup by our own reference, rather than only by the transaction UUID you generate, so we
    can determine whether the transaction was created?

28. Can the metadata field carry our internal transaction identifier for reconciliation, and is it
    returned on both success and failure callbacks? Your documentation indicates yes, and we are
    simply confirming.

Webhooks

29. We would like signed webhooks enabled on our account. Your documentation states that signing
    is optional and off by default, using HMAC SHA256 over the timestamp and raw body. Please
    enable it and issue our signing secret. (Priority)

30. Is there a timestamp tolerance window you recommend, so we can reject replayed requests
    safely?

31. If our endpoint is unavailable or returns an error, how many times and on what schedule do you
    retry? Is there a manual replay tool in the dashboard?

32. Can we register different webhook URLs for sandbox and for live?

33. Your documentation states that callbacks are sent only for final statuses. Is there any way to
    receive a processing event as well? Our users watch a payment in progress screen, and we would
    prefer to update them from your notification rather than by repeatedly polling.

34. Can the same callback be delivered more than once? We will guard against duplicates either
    way, but we want to know the expected behaviour.

Statuses

35. Please provide the complete list of statuses for both disbursements and collections, and
    indicate which of them are final. So far we have seen processing, completed, failed,
    cancelled, pending and sandbox. (Priority)

36. Is there any status in which money has already left your side but the outcome is genuinely
    unknown? That is the case that most needs an agreed procedure between our teams.

37. What is the typical time, and the worst case time, to reach a final status on MTN and on
    Airtel?

Phone verification

Your documentation lists a Phone Verification endpoint.

38. Can we use it to validate a payout number and retrieve the registered account name before the
    user commits, so that wrong numbers are caught before any money moves? Is there a charge per
    lookup?

39. Does it distinguish between a number that does not exist and a number that exists but is not
    registered for mobile money?


SECTION 6. FAILURES, REVERSALS AND REFUNDS

This matters to us more than the successful path does. Our escrow releases funds only once fiat
delivery is confirmed, so a silent failure leaves a user waiting and funds held.

40. A disbursement is accepted, our balance is debited, and the payout then fails. Is our balance
    credited back automatically, how quickly does that happen, and do we receive a notification?
    (Priority)

41. Can a disbursement that has already completed ever be reversed afterwards? If so, how are we
    informed?

42. What are the most common real-world failure reasons you see in Uganda, for example a barred
    account, a wallet limit exceeded, a dormant SIM or network downtime? Do you return a distinct
    machine-readable error code for each?

43. For collections, if a customer approves the prompt on their phone but the callback never
    reaches us, what is the correct reconciliation path?

44. Can a collection be refunded through the API if we are unable to deliver USDC on our side?

45. In sandbox, can we deliberately trigger each failure mode? Test phone numbers or specific
    amounts that force a particular error would be very helpful to us.


SECTION 7. RELIABILITY AND SUPPORT

46. What uptime do you target, and is there a status page or API we can check so our system can
    make routing decisions automatically?

47. During an MTN or Airtel outage, does your API reject requests immediately or hold them? We
    would prefer a fast rejection so we can fall back to our trader network without the user
    waiting.

48. Can you expose health per network, so we can route around a single operator being down while
    continuing to serve the other?

49. What is your escalation path and response time for a payout that is stuck? Specifically, who
    do we contact outside working hours?

50. Do you give advance notice of planned maintenance?

51. What rate limits apply to the API, and what response should we expect if we exceed them?


SECTION 8. COMPLIANCE AND RESPONSIBILITIES

52. Under whose licence are these disbursements made, and what is your regulatory standing with
    the Bank of Uganda?

53. What customer verification do you expect Rowan to perform on end users? Do you rely on our
    checks, or do you apply your own as well?

54. Do you screen payout recipients against sanctions or politically exposed person lists? If a
    payout is blocked for a compliance reason, how is that communicated to us?

55. Can we agree a written responsibility matrix covering anti-money-laundering obligations,
    transaction monitoring and suspicious activity reporting between our two companies?

56. What customer data do you require and retain, and for how long? We want to send only the
    minimum necessary.

57. Will MarzPay contact our end users directly? Our position is that Rowan owns the customer
    relationship and MarzPay operates as infrastructure behind it.

58. What is your commitment and timeline for notifying us of a data breach or security incident?


SECTION 9. ROADMAP AND EXPANSION

59. Your documentation covers Kenya and M-Pesa. Which other corridors are live or planned, and on
    what timeline? Tanzania and Rwanda are on our roadmap.

60. Bank Transfer appears in your documentation. Is it live in Uganda, and what are its limits and
    settlement times? It would be useful to us for larger cash-outs above the mobile money
    ceiling.

61. Do you have any stablecoin settlement capability, or is the full scope shillings in and
    shillings out? We settle in USDC on Stellar, so at present we would sell USDC ourselves and
    fund you in local currency. If you could accept USDC directly, that removes a treasury step
    for us.

62. On non-exclusivity. We intend to keep our trader network running and may add other providers
    for redundancy. We want to confirm that this is acceptable to you.


WHAT ROWAN WOULD DO NEXT

Once the priority questions are answered we can move quickly, because MarzPay would slot into a
provider abstraction we have already built and tested.

Phase 1. Confirmation.
Answers to this document, sandbox credentials issued, and the four marketplace services enabled.
Complete when we have written answers.

Phase 2. Adapter.
Build a MarzPay provider behind our existing payment router, with UUID references, a signed
webhook handler and status reconciliation.
Complete when reviewed, with our existing trader rail untouched.

Phase 3. Sandbox testing.
The full successful path plus every failure case.
Complete when there are no false completions and no duplicate payouts.

Phase 4. Live pilot.
Low limits, small volume, trader fallback armed.
Complete when commercial terms and compliance responsibilities are agreed.

Phase 5. Scale.
Raise limits and make MarzPay the primary Uganda rail.
Complete when success rate and settlement time are proven in production.

We are not proposing to switch off our trader network. MarzPay would be the primary automated
route, with the trader network kept as a fallback for outages and for amounts above your
per-transaction limit. That protects both sides. MarzPay does not become a single point of failure
for our users, and we can confidently grow volume on your rail knowing there is a safety net
behind it.


ROWAN CONTACT

Name: Edyelu Andrew
Role: Founder, Rowan
Phone: +256 764 331 334
Email: edyeluandrew1@gmail.com
Brand: Rowan. Borderless Value. Local Payouts.


MARZPAY DOCUMENTATION REVIEWED

API overview: https://wallet.wearemarz.com/documentation
Send Money: https://wallet.wearemarz.com/documentation/send-money
Collections: https://wallet.wearemarz.com/documentation/collections
Webhooks: https://wallet.wearemarz.com/documentation/webhooks
Service marketplace: https://wallet.wearemarz.com/service-marketplace

Reviewed 14 August 2026. Public documentation is subject to change. Account-specific availability
and commercial terms require direct confirmation.


ROWAN
Borderless Value. Local Payouts.
