# User Acceptance Testing (UAT)

## POC #40 – Internet Backbone & IXP Map

### Test Results Summary

| Test Case | Expected Result | Status |
|------------|----------------|---------|
| Click an IXP node on the map | 30% sidebar displays correct IXP name, city, country, member count, tier, and source metadata. | ✅ Pass |
| Click another IXP node | Sidebar refreshes with newly selected IXP details. | ✅ Pass |
| Click selected node again | Sidebar clears selection or returns to default state. | ✅ Pass |
| Verify PeeringDB source link | Sidebar source URL matches selected IXP PeeringDB record. | ✅ Pass |
| Apply Region filter = Europe | Only European IXPs remain visible on the map. | ✅ Pass |
| Apply Region filter = AsiaPac | Only Asia-Pacific IXPs remain visible. | ✅ Pass |
| Apply Risk filter = High | Only high-risk IXPs are displayed. | ✅ Pass |
| Apply Risk filter = Medium | Only medium-risk IXPs are displayed. | ✅ Pass |
| Enable Tier-1 Hub filter | Only Mega/Large IXPs are shown. | ✅ Pass |
| Toggle Submarine Cable layer | Cable routes appear/disappear correctly. | ✅ Pass |
| Combine Region + Risk filters | Visualization updates using both filter conditions. | ✅ Pass |
| Clear all filters | Full dataset becomes visible again. | ✅ Pass |
| Search for a known IXP | Map zooms to the selected IXP and highlights it. | ✅ Pass |
| Verify "Who Controls the Rail" ranking | ASN ranking panel matches CAIDA AS-Rank data. | ✅ Pass |
| Verify Top-5 Route Control metric | Displayed percentages match calculated CAIDA values. | ✅ Pass |
| Verify ASN organization names | ASN names correspond to CAIDA source records. | ✅ Pass |
| Verify cable count | Cable total matches TeleGeography dataset. | ✅ Pass |
| Verify IXP count | IXP total matches PeeringDB dataset. | ✅ Pass |
| Load application with backend running | Dashboard loads without API errors. | ✅ Pass |
| Simulate route failure action | Visualization updates and highlights affected entities. | ✅ Pass |

---

## UAT Summary

**Total Test Cases:** 20  
**Passed:** 20  
**Failed:** 0  
**Pass Rate:** 100%

### Final UAT Verdict

✅ **PASS**

The Internet Backbone & IXP Map dashboard successfully passed all User Acceptance Testing scenarios. Core functionality, filtering, intelligence panels, infrastructure datasets, and interactive visualization behavior operate as expected and meet the acceptance criteria for Phase 1 submission.

### Approval Status

