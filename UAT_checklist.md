# User Acceptance Testing (UAT)

## POC #40 – Internet Backbone & IXP Map

### Test Results Summary

| Test Case                            | Expected Result                                                             | Status |
| ------------------------------------ | --------------------------------------------------------------------------- | ------ |
| Load dashboard                       | Application loads successfully with no API errors.                          | ✅ Pass |
| Display IXP dataset                  | Map displays 215 IXP locations from PeeringDB.                              | ✅ Pass |
| Display submarine cable dataset      | Map displays 694 TeleGeography cable routes.                                | ✅ Pass |
| Click an IXP node                    | Intelligence panel displays IXP metadata.                                   | ✅ Pass |
| Select a different IXP               | Intelligence panel updates with newly selected IXP information.             | ✅ Pass |
| Verify PeeringDB source metadata     | Source information corresponds to the selected IXP.                         | ✅ Pass |
| Verify connected cable intelligence  | Connected cable list is generated from TeleGeography landing-point data.    | ✅ Pass |
| Enable/disable cable layer           | Cable routes appear and disappear correctly.                                | ✅ Pass |
| Apply dashboard filters              | Map updates without page refresh.                                           | ✅ Pass |
| Clear dashboard filters              | Full dataset becomes visible again.                                         | ✅ Pass |
| Verify ASN ranking panel             | Rankings match CAIDA AS-Rank dataset.                                       | ✅ Pass |
| Verify Top-5 Route Control metric    | Dashboard displays 37.6%.                                                   | ✅ Pass |
| Verify Top-10 Route Control metric   | Dashboard displays 57.9%.                                                   | ✅ Pass |
| Verify ASN organization names        | ASN names match CAIDA source records.                                       | ✅ Pass |
| Verify concentration metrics         | HHI and concentration values are calculated correctly.                      | ✅ Pass |
| Verify intelligence sidebar          | "Why This Matters" and "Who Controls the Rail" panels render correctly.     | ✅ Pass |
| Verify route failure simulation      | Simulation endpoint returns expected results.                               | ✅ Pass |
| Verify data-source labels            | PeeringDB, TeleGeography, and CAIDA AS-Rank labels are displayed correctly. | ✅ Pass |
| Verify backend seed loading          | IXP, Cable, Landing Point, and ASN datasets load successfully.              | ✅ Pass |
| Verify responsive dashboard behavior | Visualization remains functional during interaction and filtering.          | ✅ Pass |

---

## UAT Summary

**Total Test Cases:** 20

**Passed:** 20

**Failed:** 0

**Pass Rate:** 100%

### Dataset Validation

| Dataset                      | Records                                 |
| ---------------------------- | --------------------------------------- |
| PeeringDB IXPs               | 215                                     |
| TeleGeography Cables         | 694                                     |
| TeleGeography Landing Points | Spatially matched landing-point dataset |
| CAIDA AS-Rank ASNs           | 100                                     |

---

## Final UAT Verdict

### ✅ PASS

The Internet Backbone & IXP Map dashboard successfully passed all User Acceptance Testing scenarios.

The application correctly integrates:

* PeeringDB IXP intelligence
* TeleGeography submarine cable and landing-point data
* CAIDA AS-Rank concentration metrics

All major dashboard functionality, intelligence panels, filtering behavior, infrastructure visualization, and data integrations operate as expected and satisfy the acceptance criteria for Phase 1 submission.

### Approval Status

**Approved for Phase 1 Review**
