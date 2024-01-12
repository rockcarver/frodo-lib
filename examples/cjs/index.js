const {
  // default instance
  frodo,
  // default state
  state,
} = require('@rockcarver/frodo-lib');

const host0 = 'https://openam-matrix.id.forgerock.io/am',
  said0 = 'ecbfd81b-dadc-4b80-977e-260637fa2562',
  jwk0 = '{"alg":"RS256","d":"NgdJ3qp8h3YvkWoWNGgu7bWvdh7WAi-22WIeOiSX83bPKzTmvy1tRX3UXjH8LCQqTpssL8TC3y3MvEd6ddZ-6Hic-xbmJ6wbw2TMan9nr1FNaV0TFIJzIdiQ_ze0jZDe2nVxlIeY9unjinCUT-BeBcdZgAfNNAiKP01MKiynYA2v8T42AO1ha5s8dphKf9SiZ5OAf15zTwc9JP35Wd_GWa-H8bD-ZAb8dnJZuCItOjepgken_WV5YttxMw_fuSUCOkVES0EA2mmdlPLj208Voo5o8UJAk9KKzSC96Ai5n_X059gjdm_TIj4O8poVRRt3bULKlhGdHbBHChS9lgrCsk-bBLfTrQrF6j8-F3Z5pZGQ2Bm3VSf84bAmNP26XJq1TCKBfxDU7JwB-b13GdIHqekYWeTq-y4i04DvnzrPXY2op16AqqpJTQGrkNi2kU_tZ6zR_2dW6HWXMLblh2czyfst2HyS-G85yupJTa1JkZKIWB4FtQYJhwHVoFqtqXP2lx1hmJxRJicfJb1msw886RLunxFqr6RbFbmcHfDV4bYa0MroXuLjSpf8fmhDxyYDoElDTlBXE8jR9vVL1UbtClrSXo67dBItgCmSGAaKVdixUSCehog8f88mOlexj3vXhib5PVrOP7t90YAoe4o6KLkkVetZQM4erPWczaqmL28","dp":"O9LWvohCfm_HjnEVsEv8Fxd7NPWEDs6rXQahSfJ9UqiM_0W6fX_YIsAFEJGJnwdP3bgiVPBu9Qj6nOrIWxxO_EBN7XNsMB1ugsbJY3qL00jKJQM6kCUjEnEeYPxuOHI2yZ9_GLlcOw0msJpYZlVMOCI5HTgqoqLZV_JUvuu2LMSpYkjTZ4_NyKilcitZz63kelrOHpWnjXYD2JDyhz6BrohnSe_Dzzw12-bmtdT6VbzvaDX3EpFgv1qmxu1sq3bL6dtZPrR2N-L-Fft1KoZYgbYls8JmmnQjoa1ObHWlqPrLdxiAC0WvH_WFwgmQ-wO_nZ6j-ZQKXdZEpAYeELc_xw","dq":"Qzpq5mkvMRWoAIq4HASh9nEl8MtM7KMh4bqdosEad5jz-_q9UM1F5Nq0pXCg4A-O-Xi0tgKUHrxftiHqnCJAzARSpHonBxMQA_5R1Q-WHQ4OPhfoq7bPUxC8WOo9_UoIJiP56TjCRSJFTidtYBF5hkPNlc2-A9Jr_TLF0bHKW_-EhHbfoPJtEXVcW_EX-rZCXrTGg-KD9VCTYCtJbM5AunmZELzruR_lHZ3r5nUPzKeI60H0Mco1AHoHBiQUy2ZqjdTi_HFSkdGFhQOaYdkzou8rXpOOezZBrV1pfOM_hJLMpD3KMl6kqR-SDTOrPocrSRW7AHJScMlxNMYoZL_C7w","e":"AQAB","kid":"is9irY6yDLb_6BryTV10KsDAXmlOuOrmT-9KGHLBfkc","kty":"RSA","n":"w59X8v5FLIaoih4_PdGO7FQOSC1flmcMWwLqQijcd0RFeM48fefdIr6M0yKxCG1Vbdmyd0FUZibvZ2zy6jYxgDy5MAWPz0Qc7hhzdKE8VplWXG7cce5xcn4SHUz1EGQVZ0VsN3yLoSOcsNIYNJ9dYgZsy5iv051lrkJ62uDisrcOXIqfHROvbPnbEc9ZOXV4WuIb-TmCTS__YYbIc0FS5J_ByXZ1P3WEI7WGImi4xeevEkvwX1ijyJkzVw9SONoi_o6rxvbmfAAkL7ncYD54T8TCzfTzqTuZ90Rj5AFaWYj37a9jRceiD7ridP5SfHT45z7NDAR8bCi27xawKlJPYTwFVWYBTWhY9mCmKrrH70r-8VA4-I1Ni_Zk4e2Oz-ynzkf-mQQk7Uzaw0eI8NMqLxo7iD2ElMPusgV1KE7nJaoBC0jMUpT3dDAZdiO11i3zTIUwlhQlIi4uQ4GneFhmDi-5M91me3WknwK1uyK2LsgQKvxzfV6HIaPxuAbu47ZIRuPH0P6lDHuQMFy0U2ECV9vvZI6DLHGjo37jgI7XKlR5T3MLJJRGHtMePcD40My5WUZQmEKJyNbBplqd6RAsP0Rw60SJSF_Ly9ux0XSNKRurMRKlW5ZCFpjhm0kPSS0m2SstI-TN8oIZT1AXA0M7QTcVZ9t-LReuR8Yw0k-2CD0","p":"9fqcz9D9O4sbMfoPN1NhTNibSX3jYlKOtxkTnrrHyb49Yhj8ypoNsZdwOrKKKvZ1Oz_5A7jxhTHdTlphhaf8aUk53VyOGjSw3qEpO8NHAQWQZ0N_oOmlcKP3XFlaGf56WhNyFiPEhAuoAzqXZ3IPR_o87WfVYumwzHyEjrICGH2iJ0HMQcYrRsGzPYsbJNsT52H3D2Yq7vv1Hqxzc4NQwarv1PDRbCP-pxTG6gHVaseH8dLrsOv17OCib8HeYc3pPFSIKwHco4XWezbmUVu-BXiom_0EuDv5WQKm1yATgibHah2zECMdwXfL03eoDtovmGi-rrbfUDxuFqBbVmobww","q":"y5eMRV5bwIKDyCZt-YzIDD6nLCBitCmTG9coS5k9mp193S7M82KPFwPo3QkZvLIjqn5K9aQQPtf2eLPpBySxqDcoDU4-4D032-yfEwzfWLv8Bu8OuR-6Fjdg19ieaeuxsQE4Et0uGQ-hv5X0qVYHx9mHbhymDlGY0cqjRl5UCJYxL7lzWKl3156YNmKV1C_NtntlIyhG-XDlZ4zxRgOvbT-T3A_nd2O8iwH4RJ8z_KHwfTyAOka_yUoU5IiLxSCpEZVtQp1wBqxAef9--2rHIz_SvNr_kkd71mWl9UqQxByMAFwn_Dl6uix-EC3nQVayCRLGNyoQYo-n99qV6bEL_w","qi":"3KP4T8V_u4xmJ2ERNkw2Y-ll1lmZjnLdZn9zDSQNc1hJcyKE9TEWBty1jOc_WFrv1xN1WpIliH5kiAQqxokClZNB6rLWME27_ygvBuxamCUk14OplrbNMwWoNTEcXv7DtWKtHDdd-P5RpX4b-yx7oUdcC2tjqQtYQqvWx6dAx6JDOhMO1rFO4FA0GWyUHtPp5cVdUT1OT9UR51QdhaJxcQWG7rAYpQJfQzyyi5YhF4MU8Xa7isMnS6KvrQX89NeVtNpz-z-7fCdPDUwFFpLaC3o1KnKEvQi33ORqR5ROiOb9bDddxU2TSXs5oc_ex2pXF6UU7fVCuneNfy3tE-amyw"}',
  user0 = 'thomas.anderson@metacortex.com',
  pass0 = 'Blu3P!ll3d',
  host1 = 'https://openam-matrix.id.forgerock.io/am',
  said1 = 'ecbfd81b-dadc-4b80-977e-260637fa2562',
  jwk1 = '{"alg":"RS256","d":"NgdJ3qp8h3YvkWoWNGgu7bWvdh7WAi-22WIeOiSX83bPKzTmvy1tRX3UXjH8LCQqTpssL8TC3y3MvEd6ddZ-6Hic-xbmJ6wbw2TMan9nr1FNaV0TFIJzIdiQ_ze0jZDe2nVxlIeY9unjinCUT-BeBcdZgAfNNAiKP01MKiynYA2v8T42AO1ha5s8dphKf9SiZ5OAf15zTwc9JP35Wd_GWa-H8bD-ZAb8dnJZuCItOjepgken_WV5YttxMw_fuSUCOkVES0EA2mmdlPLj208Voo5o8UJAk9KKzSC96Ai5n_X059gjdm_TIj4O8poVRRt3bULKlhGdHbBHChS9lgrCsk-bBLfTrQrF6j8-F3Z5pZGQ2Bm3VSf84bAmNP26XJq1TCKBfxDU7JwB-b13GdIHqekYWeTq-y4i04DvnzrPXY2op16AqqpJTQGrkNi2kU_tZ6zR_2dW6HWXMLblh2czyfst2HyS-G85yupJTa1JkZKIWB4FtQYJhwHVoFqtqXP2lx1hmJxRJicfJb1msw886RLunxFqr6RbFbmcHfDV4bYa0MroXuLjSpf8fmhDxyYDoElDTlBXE8jR9vVL1UbtClrSXo67dBItgCmSGAaKVdixUSCehog8f88mOlexj3vXhib5PVrOP7t90YAoe4o6KLkkVetZQM4erPWczaqmL28","dp":"O9LWvohCfm_HjnEVsEv8Fxd7NPWEDs6rXQahSfJ9UqiM_0W6fX_YIsAFEJGJnwdP3bgiVPBu9Qj6nOrIWxxO_EBN7XNsMB1ugsbJY3qL00jKJQM6kCUjEnEeYPxuOHI2yZ9_GLlcOw0msJpYZlVMOCI5HTgqoqLZV_JUvuu2LMSpYkjTZ4_NyKilcitZz63kelrOHpWnjXYD2JDyhz6BrohnSe_Dzzw12-bmtdT6VbzvaDX3EpFgv1qmxu1sq3bL6dtZPrR2N-L-Fft1KoZYgbYls8JmmnQjoa1ObHWlqPrLdxiAC0WvH_WFwgmQ-wO_nZ6j-ZQKXdZEpAYeELc_xw","dq":"Qzpq5mkvMRWoAIq4HASh9nEl8MtM7KMh4bqdosEad5jz-_q9UM1F5Nq0pXCg4A-O-Xi0tgKUHrxftiHqnCJAzARSpHonBxMQA_5R1Q-WHQ4OPhfoq7bPUxC8WOo9_UoIJiP56TjCRSJFTidtYBF5hkPNlc2-A9Jr_TLF0bHKW_-EhHbfoPJtEXVcW_EX-rZCXrTGg-KD9VCTYCtJbM5AunmZELzruR_lHZ3r5nUPzKeI60H0Mco1AHoHBiQUy2ZqjdTi_HFSkdGFhQOaYdkzou8rXpOOezZBrV1pfOM_hJLMpD3KMl6kqR-SDTOrPocrSRW7AHJScMlxNMYoZL_C7w","e":"AQAB","kid":"is9irY6yDLb_6BryTV10KsDAXmlOuOrmT-9KGHLBfkc","kty":"RSA","n":"w59X8v5FLIaoih4_PdGO7FQOSC1flmcMWwLqQijcd0RFeM48fefdIr6M0yKxCG1Vbdmyd0FUZibvZ2zy6jYxgDy5MAWPz0Qc7hhzdKE8VplWXG7cce5xcn4SHUz1EGQVZ0VsN3yLoSOcsNIYNJ9dYgZsy5iv051lrkJ62uDisrcOXIqfHROvbPnbEc9ZOXV4WuIb-TmCTS__YYbIc0FS5J_ByXZ1P3WEI7WGImi4xeevEkvwX1ijyJkzVw9SONoi_o6rxvbmfAAkL7ncYD54T8TCzfTzqTuZ90Rj5AFaWYj37a9jRceiD7ridP5SfHT45z7NDAR8bCi27xawKlJPYTwFVWYBTWhY9mCmKrrH70r-8VA4-I1Ni_Zk4e2Oz-ynzkf-mQQk7Uzaw0eI8NMqLxo7iD2ElMPusgV1KE7nJaoBC0jMUpT3dDAZdiO11i3zTIUwlhQlIi4uQ4GneFhmDi-5M91me3WknwK1uyK2LsgQKvxzfV6HIaPxuAbu47ZIRuPH0P6lDHuQMFy0U2ECV9vvZI6DLHGjo37jgI7XKlR5T3MLJJRGHtMePcD40My5WUZQmEKJyNbBplqd6RAsP0Rw60SJSF_Ly9ux0XSNKRurMRKlW5ZCFpjhm0kPSS0m2SstI-TN8oIZT1AXA0M7QTcVZ9t-LReuR8Yw0k-2CD0","p":"9fqcz9D9O4sbMfoPN1NhTNibSX3jYlKOtxkTnrrHyb49Yhj8ypoNsZdwOrKKKvZ1Oz_5A7jxhTHdTlphhaf8aUk53VyOGjSw3qEpO8NHAQWQZ0N_oOmlcKP3XFlaGf56WhNyFiPEhAuoAzqXZ3IPR_o87WfVYumwzHyEjrICGH2iJ0HMQcYrRsGzPYsbJNsT52H3D2Yq7vv1Hqxzc4NQwarv1PDRbCP-pxTG6gHVaseH8dLrsOv17OCib8HeYc3pPFSIKwHco4XWezbmUVu-BXiom_0EuDv5WQKm1yATgibHah2zECMdwXfL03eoDtovmGi-rrbfUDxuFqBbVmobww","q":"y5eMRV5bwIKDyCZt-YzIDD6nLCBitCmTG9coS5k9mp193S7M82KPFwPo3QkZvLIjqn5K9aQQPtf2eLPpBySxqDcoDU4-4D032-yfEwzfWLv8Bu8OuR-6Fjdg19ieaeuxsQE4Et0uGQ-hv5X0qVYHx9mHbhymDlGY0cqjRl5UCJYxL7lzWKl3156YNmKV1C_NtntlIyhG-XDlZ4zxRgOvbT-T3A_nd2O8iwH4RJ8z_KHwfTyAOka_yUoU5IiLxSCpEZVtQp1wBqxAef9--2rHIz_SvNr_kkd71mWl9UqQxByMAFwn_Dl6uix-EC3nQVayCRLGNyoQYo-n99qV6bEL_w","qi":"3KP4T8V_u4xmJ2ERNkw2Y-ll1lmZjnLdZn9zDSQNc1hJcyKE9TEWBty1jOc_WFrv1xN1WpIliH5kiAQqxokClZNB6rLWME27_ygvBuxamCUk14OplrbNMwWoNTEcXv7DtWKtHDdd-P5RpX4b-yx7oUdcC2tjqQtYQqvWx6dAx6JDOhMO1rFO4FA0GWyUHtPp5cVdUT1OT9UR51QdhaJxcQWG7rAYpQJfQzyyi5YhF4MU8Xa7isMnS6KvrQX89NeVtNpz-z-7fCdPDUwFFpLaC3o1KnKEvQi33ORqR5ROiOb9bDddxU2TSXs5oc_ex2pXF6UU7fVCuneNfy3tE-amyw"}',
  user1 = 'thomas.anderson@metacortex.com',
  pass1 = 'Blu3P!ll3d',
  host2 = 'https://openam-matrix.id.forgerock.io/am',
  said2 = 'ecbfd81b-dadc-4b80-977e-260637fa2562',
  jwk2 = '{"alg":"RS256","d":"NgdJ3qp8h3YvkWoWNGgu7bWvdh7WAi-22WIeOiSX83bPKzTmvy1tRX3UXjH8LCQqTpssL8TC3y3MvEd6ddZ-6Hic-xbmJ6wbw2TMan9nr1FNaV0TFIJzIdiQ_ze0jZDe2nVxlIeY9unjinCUT-BeBcdZgAfNNAiKP01MKiynYA2v8T42AO1ha5s8dphKf9SiZ5OAf15zTwc9JP35Wd_GWa-H8bD-ZAb8dnJZuCItOjepgken_WV5YttxMw_fuSUCOkVES0EA2mmdlPLj208Voo5o8UJAk9KKzSC96Ai5n_X059gjdm_TIj4O8poVRRt3bULKlhGdHbBHChS9lgrCsk-bBLfTrQrF6j8-F3Z5pZGQ2Bm3VSf84bAmNP26XJq1TCKBfxDU7JwB-b13GdIHqekYWeTq-y4i04DvnzrPXY2op16AqqpJTQGrkNi2kU_tZ6zR_2dW6HWXMLblh2czyfst2HyS-G85yupJTa1JkZKIWB4FtQYJhwHVoFqtqXP2lx1hmJxRJicfJb1msw886RLunxFqr6RbFbmcHfDV4bYa0MroXuLjSpf8fmhDxyYDoElDTlBXE8jR9vVL1UbtClrSXo67dBItgCmSGAaKVdixUSCehog8f88mOlexj3vXhib5PVrOP7t90YAoe4o6KLkkVetZQM4erPWczaqmL28","dp":"O9LWvohCfm_HjnEVsEv8Fxd7NPWEDs6rXQahSfJ9UqiM_0W6fX_YIsAFEJGJnwdP3bgiVPBu9Qj6nOrIWxxO_EBN7XNsMB1ugsbJY3qL00jKJQM6kCUjEnEeYPxuOHI2yZ9_GLlcOw0msJpYZlVMOCI5HTgqoqLZV_JUvuu2LMSpYkjTZ4_NyKilcitZz63kelrOHpWnjXYD2JDyhz6BrohnSe_Dzzw12-bmtdT6VbzvaDX3EpFgv1qmxu1sq3bL6dtZPrR2N-L-Fft1KoZYgbYls8JmmnQjoa1ObHWlqPrLdxiAC0WvH_WFwgmQ-wO_nZ6j-ZQKXdZEpAYeELc_xw","dq":"Qzpq5mkvMRWoAIq4HASh9nEl8MtM7KMh4bqdosEad5jz-_q9UM1F5Nq0pXCg4A-O-Xi0tgKUHrxftiHqnCJAzARSpHonBxMQA_5R1Q-WHQ4OPhfoq7bPUxC8WOo9_UoIJiP56TjCRSJFTidtYBF5hkPNlc2-A9Jr_TLF0bHKW_-EhHbfoPJtEXVcW_EX-rZCXrTGg-KD9VCTYCtJbM5AunmZELzruR_lHZ3r5nUPzKeI60H0Mco1AHoHBiQUy2ZqjdTi_HFSkdGFhQOaYdkzou8rXpOOezZBrV1pfOM_hJLMpD3KMl6kqR-SDTOrPocrSRW7AHJScMlxNMYoZL_C7w","e":"AQAB","kid":"is9irY6yDLb_6BryTV10KsDAXmlOuOrmT-9KGHLBfkc","kty":"RSA","n":"w59X8v5FLIaoih4_PdGO7FQOSC1flmcMWwLqQijcd0RFeM48fefdIr6M0yKxCG1Vbdmyd0FUZibvZ2zy6jYxgDy5MAWPz0Qc7hhzdKE8VplWXG7cce5xcn4SHUz1EGQVZ0VsN3yLoSOcsNIYNJ9dYgZsy5iv051lrkJ62uDisrcOXIqfHROvbPnbEc9ZOXV4WuIb-TmCTS__YYbIc0FS5J_ByXZ1P3WEI7WGImi4xeevEkvwX1ijyJkzVw9SONoi_o6rxvbmfAAkL7ncYD54T8TCzfTzqTuZ90Rj5AFaWYj37a9jRceiD7ridP5SfHT45z7NDAR8bCi27xawKlJPYTwFVWYBTWhY9mCmKrrH70r-8VA4-I1Ni_Zk4e2Oz-ynzkf-mQQk7Uzaw0eI8NMqLxo7iD2ElMPusgV1KE7nJaoBC0jMUpT3dDAZdiO11i3zTIUwlhQlIi4uQ4GneFhmDi-5M91me3WknwK1uyK2LsgQKvxzfV6HIaPxuAbu47ZIRuPH0P6lDHuQMFy0U2ECV9vvZI6DLHGjo37jgI7XKlR5T3MLJJRGHtMePcD40My5WUZQmEKJyNbBplqd6RAsP0Rw60SJSF_Ly9ux0XSNKRurMRKlW5ZCFpjhm0kPSS0m2SstI-TN8oIZT1AXA0M7QTcVZ9t-LReuR8Yw0k-2CD0","p":"9fqcz9D9O4sbMfoPN1NhTNibSX3jYlKOtxkTnrrHyb49Yhj8ypoNsZdwOrKKKvZ1Oz_5A7jxhTHdTlphhaf8aUk53VyOGjSw3qEpO8NHAQWQZ0N_oOmlcKP3XFlaGf56WhNyFiPEhAuoAzqXZ3IPR_o87WfVYumwzHyEjrICGH2iJ0HMQcYrRsGzPYsbJNsT52H3D2Yq7vv1Hqxzc4NQwarv1PDRbCP-pxTG6gHVaseH8dLrsOv17OCib8HeYc3pPFSIKwHco4XWezbmUVu-BXiom_0EuDv5WQKm1yATgibHah2zECMdwXfL03eoDtovmGi-rrbfUDxuFqBbVmobww","q":"y5eMRV5bwIKDyCZt-YzIDD6nLCBitCmTG9coS5k9mp193S7M82KPFwPo3QkZvLIjqn5K9aQQPtf2eLPpBySxqDcoDU4-4D032-yfEwzfWLv8Bu8OuR-6Fjdg19ieaeuxsQE4Et0uGQ-hv5X0qVYHx9mHbhymDlGY0cqjRl5UCJYxL7lzWKl3156YNmKV1C_NtntlIyhG-XDlZ4zxRgOvbT-T3A_nd2O8iwH4RJ8z_KHwfTyAOka_yUoU5IiLxSCpEZVtQp1wBqxAef9--2rHIz_SvNr_kkd71mWl9UqQxByMAFwn_Dl6uix-EC3nQVayCRLGNyoQYo-n99qV6bEL_w","qi":"3KP4T8V_u4xmJ2ERNkw2Y-ll1lmZjnLdZn9zDSQNc1hJcyKE9TEWBty1jOc_WFrv1xN1WpIliH5kiAQqxokClZNB6rLWME27_ygvBuxamCUk14OplrbNMwWoNTEcXv7DtWKtHDdd-P5RpX4b-yx7oUdcC2tjqQtYQqvWx6dAx6JDOhMO1rFO4FA0GWyUHtPp5cVdUT1OT9UR51QdhaJxcQWG7rAYpQJfQzyyi5YhF4MU8Xa7isMnS6KvrQX89NeVtNpz-z-7fCdPDUwFFpLaC3o1KnKEvQi33ORqR5ROiOb9bDddxU2TSXs5oc_ex2pXF6UU7fVCuneNfy3tE-amyw"}',
  user2 = 'thomas.anderson@metacortex.com',
  pass2 = 'Blu3P!ll3d';

/**
 * create a new instance using factory helper function and login as service account
 */
async function newFactoryHelperServiceAccountLogin() {
  console.log(
    `\n********** BEGIN ********** newFactoryHelperServiceAccountLogin **********`
  );
  const myFrodo1 = frodo.createInstanceWithServiceAccount(
    host1, // host base URL
    said1, // service account id
    jwk1 // service account jwk as a string
  );

  // destructure default instance for easier use of library functions
  const { getTokens } = myFrodo1.login;
  const { getInfo } = myFrodo1.info;

  // login and obtain tokens
  if (await getTokens()) {
    // obtain and print information about the instance you are connected to
    const info = await getInfo();
    console.log(
      `newFactoryHelperServiceAccountLogin: Logged in to: ${info.host}`
    );
    console.log(
      `newFactoryHelperServiceAccountLogin: Logged in as: ${info.authenticatedSubject}`
    );
    console.log(
      `newFactoryHelperServiceAccountLogin: Using bearer token: \n${info.bearerToken}`
    );
  } else {
    console.log('error getting tokens');
  }
  console.log(
    `********** END ************ newFactoryHelperServiceAccountLogin **********\n`
  );
}
newFactoryHelperServiceAccountLogin();

/**
 * create a new instance using factory helper function and login as admin user
 */
async function newFactoryHelperAdminLogin() {
  console.log(
    `\n********** BEGIN ********** newFactoryHelperAdminLogin **********`
  );
  const myFrodo1 = frodo.createInstanceWithAdminAccount(
    host1, // host base URL
    user1, // admin username
    pass1 // admin password
  );

  // destructure default instance for easier use of library functions
  const { getTokens } = myFrodo1.login;
  const { getInfo } = myFrodo1.info;

  // login and obtain tokens
  if (await getTokens()) {
    // obtain and print information about the instance you are connected to
    const info = await getInfo();
    console.log(`newFactoryHelperAdminLogin: Logged in to: ${info.host}`);
    console.log(
      `newFactoryHelperAdminLogin: Logged in as: ${info.authenticatedSubject}`
    );
    console.log(
      `newFactoryHelperAdminLogin: Using bearer token: \n${info.bearerToken}`
    );
  } else {
    console.log('error getting tokens');
  }
  console.log(
    `********** END ************ newFactoryHelperAdminLogin **********\n`
  );
}
newFactoryHelperAdminLogin();

/**
 * create a new instance using factory function and login as service account
 */
async function newFactoryServiceAccountLogin() {
  console.log(
    `\n********** BEGIN ********** newFactoryServiceAccountLogin **********`
  );
  const myFrodo2 = frodo.createInstance({
    host: host2, // host base URL
    serviceAccountId: said2, // service account id
    serviceAccountJwk: JSON.parse(jwk2), // service account jwk as a JwkRsa object
  });

  // destructure default instance for easier use of library functions
  const { getTokens } = myFrodo2.login;
  const { getInfo } = myFrodo2.info;

  // login and obtain tokens
  if (await getTokens()) {
    // obtain and print information about the instance you are connected to
    const info = await getInfo();
    console.log(`newFactoryServiceAccountLogin: Logged in to: ${info.host}`);
    console.log(
      `newFactoryServiceAccountLogin: Logged in as: ${info.authenticatedSubject}`
    );
    console.log(
      `newFactoryServiceAccountLogin: Using bearer token: \n${info.bearerToken}`
    );
  } else {
    console.log('error getting tokens');
  }
  console.log(
    `********** END ************ newFactoryServiceAccountLogin **********\n`
  );
}
newFactoryServiceAccountLogin();

/**
 * create a new instance using factory function and login as admin user
 */
async function newFactoryAdminLogin() {
  console.log(`\n********** BEGIN ********** newFactoryAdminLogin **********`);
  const myFrodo2 = frodo.createInstance({
    host: host2, // host base URL
    username: user2, // admin username
    password: pass2, // admin password
  });

  // destructure default instance for easier use of library functions
  const { getTokens } = myFrodo2.login;
  const { getInfo } = myFrodo2.info;

  // login and obtain tokens
  if (await getTokens()) {
    // obtain and print information about the instance you are connected to
    const info = await getInfo();
    console.log(`newFactoryAdminLogin: Logged in to: ${info.host}`);
    console.log(
      `newFactoryAdminLogin: Logged in as: ${info.authenticatedSubject}`
    );
    console.log(
      `newFactoryAdminLogin: Using bearer token: \n${info.bearerToken}`
    );
  } else {
    console.log('error getting tokens');
  }
  console.log(`********** END ************ newFactoryAdminLogin **********\n`);
}
newFactoryAdminLogin();

/**
 * use default instance and state and login as service account
 */
async function defaultServiceAccountLogin() {
  console.log(
    `\n********** BEGIN ********** defaultServiceAccountLogin **********`
  );
  // destructure default instance for easier use of library functions
  const { getTokens } = frodo.login;
  const { getInfo } = frodo.info;

  // The default state instance is a singleton. It is best to reset() the state before
  // logging in to avoid interference. In this particular case no previous method in
  // this file is using the default state but it is good practice to call reset() if
  // you are not sure and need a clean state.
  state.reset();

  // host base URL
  state.setHost(host0);
  // service account id
  state.setServiceAccountId(said0);
  // service account jwk as a JwkRsa object
  state.setServiceAccountJwk(JSON.parse(jwk0));

  // login and obtain tokens
  if (await getTokens()) {
    // obtain and print information about the instance you are connected to
    const info = await getInfo();
    console.log(`defaultServiceAccountLogin: Logged in to: ${info.host}`);
    console.log(
      `defaultServiceAccountLogin: Logged in as: ${info.authenticatedSubject}`
    );
    console.log(
      `defaultServiceAccountLogin: Using bearer token: \n${info.bearerToken}`
    );
  } else {
    console.log('error getting tokens');
  }
  console.log(
    `********** END ************ defaultServiceAccountLogin **********\n`
  );
}
defaultServiceAccountLogin();

/**
 * use default instance and state
 */
async function defaultAdminLogin() {
  console.log(`\n********** BEGIN ********** defaultAdminLogin **********`);
  // destructure default instance for easier use of library functions
  const { getTokens } = frodo.login;
  const { getInfo } = frodo.info;

  // The default state instance is a singleton. It is best to reset() the state before
  // logging in to avoid interference. In this particular case the previous method in
  // this file is populating the state with a service account login and the admin login
  // could possibly fail.
  state.reset();

  // host base URL
  state.setHost(host0);
  // username of an admin user
  state.setUsername(user0);
  // password of the admin user
  state.setPassword(pass0);

  // login and obtain tokens
  if (await getTokens()) {
    // obtain and print information about the instance you are connected to
    const info = await getInfo();
    console.log(`defaultAdminLogin: Logged in to: ${info.host}`);
    console.log(
      `defaultAdminLogin: Logged in as: ${info.authenticatedSubject}`
    );
    console.log(`defaultAdminLogin: Using bearer token: \n${info.bearerToken}`);
  } else {
    console.log('error getting tokens');
  }
  console.log(`********** END ************ defaultAdminLogin **********\n`);
}
defaultAdminLogin();
