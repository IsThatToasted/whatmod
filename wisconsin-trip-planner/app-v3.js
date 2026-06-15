(() => {
  'use strict';
  if (window.__BCC_APP_LOADED__) return;
  window.__BCC_APP_LOADED__ = true;

  const CONFIG = window.COMPAT_CONFIG || window.TRIP_CONFIG || {};
  const sb = window.supabase?.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_PUBLISHABLE_KEY);

const QUESTIONS = [
  {
    "id": "consent_safety_1_how_important_is_a_clear_yes_befor",
    "category": "Consent & Safety",
    "text": "How important is a clear yes before trying anything new in bed?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "consent_safety_2_how_interested_are_you_in_talking",
    "category": "Consent & Safety",
    "text": "How interested are you in talking about boundaries before things get sexual?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "consent_safety_3_how_comfortable_are_you_using_a_sa",
    "category": "Consent & Safety",
    "text": "How comfortable are you using a safe word or pause word?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "consent_safety_4_how_important_is_it_that_either_pe",
    "category": "Consent & Safety",
    "text": "How important is it that either person can stop immediately without pressure?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "consent_safety_5_how_interested_are_you_in_checking",
    "category": "Consent & Safety",
    "text": "How interested are you in checking in during intense or new experiences?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "consent_safety_6_how_comfortable_are_you_saying_no",
    "category": "Consent & Safety",
    "text": "How comfortable are you saying no directly during intimacy?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "consent_safety_7_how_important_is_aftercare_after_i",
    "category": "Consent & Safety",
    "text": "How important is aftercare after intense sexual experiences?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "consent_safety_8_how_interested_are_you_in_discussi",
    "category": "Consent & Safety",
    "text": "How interested are you in discussing STI testing and protection before sex?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "consent_safety_9_how_comfortable_are_you_with_plann",
    "category": "Consent & Safety",
    "text": "How comfortable are you with planning contraception or pregnancy-prevention details?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "consent_safety_10_how_important_is_privacy_around_an",
    "category": "Consent & Safety",
    "text": "How important is privacy around anything sexual shared in this app?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "communication_1_how_interested_are_you_in_openly_d",
    "category": "Communication",
    "text": "How interested are you in openly discussing what feels good?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "communication_2_how_comfortable_are_you_asking_for",
    "category": "Communication",
    "text": "How comfortable are you asking for exactly what you want in bed?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "communication_3_how_interested_are_you_in_receivin",
    "category": "Communication",
    "text": "How interested are you in receiving direct feedback during sex?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "communication_4_how_comfortable_are_you_giving_dir",
    "category": "Communication",
    "text": "How comfortable are you giving direct feedback during sex?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "communication_5_how_interested_are_you_in_discussi",
    "category": "Communication",
    "text": "How interested are you in discussing fantasies before trying them?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "communication_6_how_comfortable_are_you_talking_ab",
    "category": "Communication",
    "text": "How comfortable are you talking about turn-offs without taking it personally?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "communication_7_how_interested_are_you_in_having_a",
    "category": "Communication",
    "text": "How interested are you in having a post-sex check-in?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "communication_8_how_comfortable_are_you_naming_spe",
    "category": "Communication",
    "text": "How comfortable are you naming specific things you enjoyed afterward?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "communication_9_how_interested_are_you_in_using_pl",
    "category": "Communication",
    "text": "How interested are you in using playful texts to build anticipation?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "communication_10_how_comfortable_are_you_talking_ab",
    "category": "Communication",
    "text": "How comfortable are you talking about sex outside the bedroom?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "desire_frequency_1_how_interested_are_you_in_frequent",
    "category": "Desire & Frequency",
    "text": "How interested are you in frequent sexual connection when together?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "desire_frequency_2_how_interested_are_you_in_slower",
    "category": "Desire & Frequency",
    "text": "How interested are you in slower, less frequent but more intentional sex?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "desire_frequency_3_how_interested_are_you_in_spontane",
    "category": "Desire & Frequency",
    "text": "How interested are you in spontaneous sex?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "desire_frequency_4_how_interested_are_you_in_planned",
    "category": "Desire & Frequency",
    "text": "How interested are you in planned sex dates?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "desire_frequency_5_how_important_is_feeling_emotional",
    "category": "Desire & Frequency",
    "text": "How important is feeling emotionally connected before sex?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "desire_frequency_6_how_interested_are_you_in_quick_se",
    "category": "Desire & Frequency",
    "text": "How interested are you in quick sexual moments when time is limited?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "desire_frequency_7_how_interested_are_you_in_long_un",
    "category": "Desire & Frequency",
    "text": "How interested are you in long, unrushed bedroom time?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "desire_frequency_8_how_comfortable_are_you_initiating",
    "category": "Desire & Frequency",
    "text": "How comfortable are you initiating sex first?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "desire_frequency_9_how_comfortable_are_you_with_the_o",
    "category": "Desire & Frequency",
    "text": "How comfortable are you with the other person initiating most often?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "desire_frequency_10_how_important_is_matching_sexual_e",
    "category": "Desire & Frequency",
    "text": "How important is matching sexual energy levels?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "affection_foreplay_1_how_interested_are_you_in_extended",
    "category": "Affection & Foreplay",
    "text": "How interested are you in extended kissing before sex?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "affection_foreplay_2_how_interested_are_you_in_cuddling",
    "category": "Affection & Foreplay",
    "text": "How interested are you in cuddling before sex?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "affection_foreplay_3_how_interested_are_you_in_massage",
    "category": "Affection & Foreplay",
    "text": "How interested are you in massage as part of foreplay?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "affection_foreplay_4_how_interested_are_you_in_slow_tou",
    "category": "Affection & Foreplay",
    "text": "How interested are you in slow touching before sex?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "affection_foreplay_5_how_interested_are_you_in_playful",
    "category": "Affection & Foreplay",
    "text": "How interested are you in playful teasing before sex?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "affection_foreplay_6_how_interested_are_you_in_verbal_c",
    "category": "Affection & Foreplay",
    "text": "How interested are you in verbal compliments during foreplay?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "affection_foreplay_7_how_interested_are_you_in_sensual",
    "category": "Affection & Foreplay",
    "text": "How interested are you in sensual shower or bath time together?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "affection_foreplay_8_how_interested_are_you_in_non_sexu",
    "category": "Affection & Foreplay",
    "text": "How interested are you in non-sexual touch that may lead to sex?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "affection_foreplay_9_how_interested_are_you_in_taking_t",
    "category": "Affection & Foreplay",
    "text": "How interested are you in taking turns focusing on each other?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "affection_foreplay_10_how_important_is_warming_up_slowly",
    "category": "Affection & Foreplay",
    "text": "How important is warming up slowly before anything intense?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "pace_intensity_1_how_interested_are_you_in_slow_and",
    "category": "Pace & Intensity",
    "text": "How interested are you in slow and gentle sex?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "pace_intensity_2_how_interested_are_you_in_passiona",
    "category": "Pace & Intensity",
    "text": "How interested are you in passionate, high-energy sex?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "pace_intensity_3_how_interested_are_you_in_switchin",
    "category": "Pace & Intensity",
    "text": "How interested are you in switching between gentle and intense?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "pace_intensity_4_how_interested_are_you_in_being_gu",
    "category": "Pace & Intensity",
    "text": "How interested are you in being guided by the other person?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "pace_intensity_5_how_interested_are_you_in_guiding",
    "category": "Pace & Intensity",
    "text": "How interested are you in guiding the other person?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "pace_intensity_6_how_comfortable_are_you_with_inten",
    "category": "Pace & Intensity",
    "text": "How comfortable are you with intensity increasing gradually?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "pace_intensity_7_how_interested_are_you_in_playful",
    "category": "Pace & Intensity",
    "text": "How interested are you in playful roughness within clear boundaries?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "pace_intensity_8_how_interested_are_you_in_very_ten",
    "category": "Pace & Intensity",
    "text": "How interested are you in very tender, romantic bedroom energy?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "pace_intensity_9_how_interested_are_you_in_adventur",
    "category": "Pace & Intensity",
    "text": "How interested are you in adventurous, experimental bedroom energy?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "pace_intensity_10_how_important_is_matching_pace_in",
    "category": "Pace & Intensity",
    "text": "How important is matching pace in the moment?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "position_preferences_1_how_interested_are_you_in_face_to",
    "category": "Position Preferences",
    "text": "How interested are you in face-to-face positions?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "position_preferences_2_how_interested_are_you_in_position",
    "category": "Position Preferences",
    "text": "How interested are you in positions with lots of kissing?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "position_preferences_3_how_interested_are_you_in_position",
    "category": "Position Preferences",
    "text": "How interested are you in positions where one person takes the lead?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "position_preferences_4_how_interested_are_you_in_switchin",
    "category": "Position Preferences",
    "text": "How interested are you in switching positions often?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "position_preferences_5_how_interested_are_you_in_keeping",
    "category": "Position Preferences",
    "text": "How interested are you in keeping positions simple and comfortable?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "position_preferences_6_how_interested_are_you_in_trying_n",
    "category": "Position Preferences",
    "text": "How interested are you in trying new positions together?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "position_preferences_7_how_interested_are_you_in_standing",
    "category": "Position Preferences",
    "text": "How interested are you in standing positions?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "position_preferences_8_how_interested_are_you_in_seated_o",
    "category": "Position Preferences",
    "text": "How interested are you in seated or lap-based positions?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "position_preferences_9_how_interested_are_you_in_side_by",
    "category": "Position Preferences",
    "text": "How interested are you in side-by-side positions?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "position_preferences_10_how_important_is_avoiding_position",
    "category": "Position Preferences",
    "text": "How important is avoiding positions that feel physically uncomfortable?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "locations_settings_1_how_interested_are_you_in_keeping",
    "category": "Locations & Settings",
    "text": "How interested are you in keeping sex mostly in the bedroom?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "locations_settings_2_how_interested_are_you_in_sex_some",
    "category": "Locations & Settings",
    "text": "How interested are you in sex somewhere private but outside the bedroom?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "locations_settings_3_how_interested_are_you_in_hotel_ro",
    "category": "Locations & Settings",
    "text": "How interested are you in hotel-room intimacy?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "locations_settings_4_how_interested_are_you_in_shower_i",
    "category": "Locations & Settings",
    "text": "How interested are you in shower intimacy?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "locations_settings_5_how_interested_are_you_in_couch_or",
    "category": "Locations & Settings",
    "text": "How interested are you in couch or living-room intimacy when private?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "locations_settings_6_how_interested_are_you_in_vacation",
    "category": "Locations & Settings",
    "text": "How interested are you in vacation or travel intimacy?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "locations_settings_7_how_interested_are_you_in_spontane",
    "category": "Locations & Settings",
    "text": "How interested are you in spontaneous private locations?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "locations_settings_8_how_important_is_a_locked_door_and",
    "category": "Locations & Settings",
    "text": "How important is a locked door and full privacy?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "locations_settings_9_how_interested_are_you_in_candles",
    "category": "Locations & Settings",
    "text": "How interested are you in candles, lighting, or mood-setting?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "locations_settings_10_how_interested_are_you_in_music_or",
    "category": "Locations & Settings",
    "text": "How interested are you in music or background sound during sex?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "fantasy_imagination_1_how_interested_are_you_in_sharing",
    "category": "Fantasy & Imagination",
    "text": "How interested are you in sharing sexual fantasies verbally?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "fantasy_imagination_2_how_interested_are_you_in_acting_o",
    "category": "Fantasy & Imagination",
    "text": "How interested are you in acting out light fantasy scenarios?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "fantasy_imagination_3_how_interested_are_you_in_being_su",
    "category": "Fantasy & Imagination",
    "text": "How interested are you in being surprised with a fantasy idea?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "fantasy_imagination_4_how_interested_are_you_in_creating",
    "category": "Fantasy & Imagination",
    "text": "How interested are you in creating a shared fantasy list?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "fantasy_imagination_5_how_interested_are_you_in_romantic",
    "category": "Fantasy & Imagination",
    "text": "How interested are you in romantic fantasy themes?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "fantasy_imagination_6_how_interested_are_you_in_playful",
    "category": "Fantasy & Imagination",
    "text": "How interested are you in playful power-exchange fantasy themes?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "fantasy_imagination_7_how_interested_are_you_in_stranger",
    "category": "Fantasy & Imagination",
    "text": "How interested are you in stranger-style roleplay between consenting adults?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "fantasy_imagination_8_how_interested_are_you_in_outfit_b",
    "category": "Fantasy & Imagination",
    "text": "How interested are you in outfit-based fantasy?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "fantasy_imagination_9_how_interested_are_you_in_fantasy",
    "category": "Fantasy & Imagination",
    "text": "How interested are you in fantasy that stays as talk only?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "fantasy_imagination_10_how_important_is_separating_fantas",
    "category": "Fantasy & Imagination",
    "text": "How important is separating fantasy from real-life expectations?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "kink_power_dynamics_1_how_interested_are_you_in_light_do",
    "category": "Kink & Power Dynamics",
    "text": "How interested are you in light dominance and submission dynamics?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "kink_power_dynamics_2_how_interested_are_you_in_being_mo",
    "category": "Kink & Power Dynamics",
    "text": "How interested are you in being more dominant in bed?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "kink_power_dynamics_3_how_interested_are_you_in_being_mo",
    "category": "Kink & Power Dynamics",
    "text": "How interested are you in being more submissive in bed?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "kink_power_dynamics_4_how_interested_are_you_in_switchin",
    "category": "Kink & Power Dynamics",
    "text": "How interested are you in switching roles depending on mood?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "kink_power_dynamics_5_how_interested_are_you_in_light_re",
    "category": "Kink & Power Dynamics",
    "text": "How interested are you in light restraints with clear consent?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "kink_power_dynamics_6_how_interested_are_you_in_blindfol",
    "category": "Kink & Power Dynamics",
    "text": "How interested are you in blindfolds or sensory restriction?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "kink_power_dynamics_7_how_interested_are_you_in_playful",
    "category": "Kink & Power Dynamics",
    "text": "How interested are you in playful commands or instruction?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "kink_power_dynamics_8_how_interested_are_you_in_praise_f",
    "category": "Kink & Power Dynamics",
    "text": "How interested are you in praise-focused dynamics?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "kink_power_dynamics_9_how_interested_are_you_in_teasing",
    "category": "Kink & Power Dynamics",
    "text": "How interested are you in teasing or denial within clear limits?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "kink_power_dynamics_10_how_important_is_negotiating_kink",
    "category": "Kink & Power Dynamics",
    "text": "How important is negotiating kink boundaries before trying anything?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "words_sounds_1_how_interested_are_you_in_dirty_ta",
    "category": "Words & Sounds",
    "text": "How interested are you in dirty talk?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "words_sounds_2_how_interested_are_you_in_soft_rom",
    "category": "Words & Sounds",
    "text": "How interested are you in soft romantic talk during sex?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "words_sounds_3_how_interested_are_you_in_praise_d",
    "category": "Words & Sounds",
    "text": "How interested are you in praise during sex?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "words_sounds_4_how_interested_are_you_in_being_to",
    "category": "Words & Sounds",
    "text": "How interested are you in being told what to do during sex?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "words_sounds_5_how_interested_are_you_in_giving_i",
    "category": "Words & Sounds",
    "text": "How interested are you in giving instructions during sex?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "words_sounds_6_how_comfortable_are_you_being_voca",
    "category": "Words & Sounds",
    "text": "How comfortable are you being vocal during sex?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "words_sounds_7_how_interested_are_you_in_quiet_in",
    "category": "Words & Sounds",
    "text": "How interested are you in quiet intimacy?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "words_sounds_8_how_interested_are_you_in_teasing",
    "category": "Words & Sounds",
    "text": "How interested are you in teasing messages before meeting?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "words_sounds_9_how_interested_are_you_in_voice_no",
    "category": "Words & Sounds",
    "text": "How interested are you in voice notes for sexual anticipation?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "words_sounds_10_how_important_is_avoiding_language",
    "category": "Words & Sounds",
    "text": "How important is avoiding language that feels disrespectful?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "toys_props_enhancements_1_how_interested_are_you_in_using_ad",
    "category": "Toys, Props & Enhancements",
    "text": "How interested are you in using adult toys together?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "toys_props_enhancements_2_how_interested_are_you_in_trying_a",
    "category": "Toys, Props & Enhancements",
    "text": "How interested are you in trying a toy chosen by the other person?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "toys_props_enhancements_3_how_interested_are_you_in_shopping",
    "category": "Toys, Props & Enhancements",
    "text": "How interested are you in shopping for adult items together?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "toys_props_enhancements_4_how_interested_are_you_in_massage",
    "category": "Toys, Props & Enhancements",
    "text": "How interested are you in massage oil or lotion?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "toys_props_enhancements_5_how_interested_are_you_in_lingerie",
    "category": "Toys, Props & Enhancements",
    "text": "How interested are you in lingerie or revealing outfits?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "toys_props_enhancements_6_how_interested_are_you_in_heels_or",
    "category": "Toys, Props & Enhancements",
    "text": "How interested are you in heels or specific bedroom clothing?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "toys_props_enhancements_7_how_interested_are_you_in_light_re",
    "category": "Toys, Props & Enhancements",
    "text": "How interested are you in light restraints or soft ties?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "toys_props_enhancements_8_how_interested_are_you_in_blindfol",
    "category": "Toys, Props & Enhancements",
    "text": "How interested are you in blindfolds?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "toys_props_enhancements_9_how_interested_are_you_in_temperat",
    "category": "Toys, Props & Enhancements",
    "text": "How interested are you in temperature play using safe items?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "toys_props_enhancements_10_how_important_is_discussing_cleani",
    "category": "Toys, Props & Enhancements",
    "text": "How important is discussing cleaning and safety for any toys used?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "digital_distance_1_how_interested_are_you_in_flirty_t",
    "category": "Digital & Distance",
    "text": "How interested are you in flirty texting when apart?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "digital_distance_2_how_interested_are_you_in_private",
    "category": "Digital & Distance",
    "text": "How interested are you in private photo sharing with clear consent?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "digital_distance_3_how_interested_are_you_in_video_in",
    "category": "Digital & Distance",
    "text": "How interested are you in video intimacy when apart?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "digital_distance_4_how_interested_are_you_in_planned",
    "category": "Digital & Distance",
    "text": "How interested are you in planned long-distance date nights with sexual tension?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "digital_distance_5_how_interested_are_you_in_writing",
    "category": "Digital & Distance",
    "text": "How interested are you in writing fantasy messages to each other?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "digital_distance_6_how_interested_are_you_in_countdow",
    "category": "Digital & Distance",
    "text": "How interested are you in countdowns before meeting in person?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "digital_distance_7_how_interested_are_you_in_saving_p",
    "category": "Digital & Distance",
    "text": "How interested are you in saving private memories from intimate trips?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "digital_distance_8_how_important_is_no_screenshots_or",
    "category": "Digital & Distance",
    "text": "How important is no screenshots or saving without permission?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "digital_distance_9_how_interested_are_you_in_remote_c",
    "category": "Digital & Distance",
    "text": "How interested are you in remote-controlled adult toys if both consent?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "digital_distance_10_how_important_is_keeping_digital_i",
    "category": "Digital & Distance",
    "text": "How important is keeping digital intimacy fully private?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "boundaries_limits_1_how_important_is_having_a_hard_no",
    "category": "Boundaries & Limits",
    "text": "How important is having a hard-no list?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "boundaries_limits_2_how_interested_are_you_in_having_a",
    "category": "Boundaries & Limits",
    "text": "How interested are you in having a maybe list for future exploration?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "boundaries_limits_3_how_comfortable_are_you_revisiting",
    "category": "Boundaries & Limits",
    "text": "How comfortable are you revisiting boundaries as trust grows?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "boundaries_limits_4_how_important_is_avoiding_pain_bey",
    "category": "Boundaries & Limits",
    "text": "How important is avoiding pain beyond playful or mild levels?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "boundaries_limits_5_how_important_is_avoiding_humiliat",
    "category": "Boundaries & Limits",
    "text": "How important is avoiding humiliation or degradation?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "boundaries_limits_6_how_important_is_avoiding_public_r",
    "category": "Boundaries & Limits",
    "text": "How important is avoiding public-risk situations?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "boundaries_limits_7_how_important_is_avoiding_anything",
    "category": "Boundaries & Limits",
    "text": "How important is avoiding anything involving recording?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "boundaries_limits_8_how_important_is_avoiding_surprise",
    "category": "Boundaries & Limits",
    "text": "How important is avoiding surprise sexual ideas without discussion first?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "boundaries_limits_9_how_important_is_respecting_body_i",
    "category": "Boundaries & Limits",
    "text": "How important is respecting body insecurities during sex?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "boundaries_limits_10_how_important_is_keeping_certain_f",
    "category": "Boundaries & Limits",
    "text": "How important is keeping certain fantasies as fantasy only?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "sexual_past_experience_1_how_comfortable_are_you_discussing",
    "category": "Sexual Past & Experience",
    "text": "How comfortable are you discussing past sexual experience in general terms?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "sexual_past_experience_2_how_comfortable_are_you_sharing_wh",
    "category": "Sexual Past & Experience",
    "text": "How comfortable are you sharing what has worked well for you before?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "sexual_past_experience_3_how_comfortable_are_you_sharing_wh",
    "category": "Sexual Past & Experience",
    "text": "How comfortable are you sharing what has not worked well before?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "sexual_past_experience_4_how_important_is_not_comparing_eac",
    "category": "Sexual Past & Experience",
    "text": "How important is not comparing each other to past sexual experiences?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "sexual_past_experience_5_how_comfortable_are_you_talking_ab",
    "category": "Sexual Past & Experience",
    "text": "How comfortable are you talking about previous boundaries you discovered?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "sexual_past_experience_6_how_comfortable_are_you_talking_ab",
    "category": "Sexual Past & Experience",
    "text": "How comfortable are you talking about past awkward sexual moments lightly?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "sexual_past_experience_7_how_comfortable_are_you_discussing",
    "category": "Sexual Past & Experience",
    "text": "How comfortable are you discussing past use of adult toys or kink?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "sexual_past_experience_8_how_comfortable_are_you_discussing",
    "category": "Sexual Past & Experience",
    "text": "How comfortable are you discussing what you want to do differently now?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "sexual_past_experience_9_how_important_is_privacy_around_pa",
    "category": "Sexual Past & Experience",
    "text": "How important is privacy around past sexual details?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  },
  {
    "id": "sexual_past_experience_10_how_comfortable_are_you_saying_you",
    "category": "Sexual Past & Experience",
    "text": "How comfortable are you saying you are inexperienced with something?",
    "options": [
      "No interest",
      "Maybe / unsure",
      "Interested",
      "Very interested"
    ],
    "compatible": "same_or_close"
  }
];

const $ = id => document.getElementById(id);
const els = ['loadingView','signedOutView','setupView','homeView','sessionView','loginBtn','logoutBtn','userBadge','displayNameInput','saveProfileBtn','createSessionBtn','sessionList','backBtn','copyInviteBtn','copyInviteBtn2','inviteLinkInput','inviteBox','sessionTitle','partnerLine','progressText','progressBar','syncStatus','questionArea','finalScoreCard','toggleViewBtn'].reduce((a,id)=>(a[id]=$(id),a),{});

let state = { user:null, profile:null, sessions:[], activeSession:null, members:[], answers:[], channel:null, cardMode:false };

function showToast(msg){ const t=$('toast'); t.textContent=msg; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'),2200); }
function showOnly(view){ ['loadingView','signedOutView','homeView','sessionView'].forEach(id=>els[id].classList.add('hidden')); if(view) els[view].classList.remove('hidden'); }
function appUrlForSession(id){ const u = new URL(location.href); u.searchParams.set('session', id); return u.toString(); }
function displayName(profile, user){ return profile?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Other person'; }
function optionIndex(q, value){ return q.options.indexOf(value); }
function isCompatible(q, a, b){ if(!a || !b) return null; if(a.answer_value === b.answer_value) return true; if(q.compatible === 'same_or_close') return Math.abs(optionIndex(q,a.answer_value)-optionIndex(q,b.answer_value)) <= 1; return false; }
function participantName(userId){ const m=state.members.find(x=>x.user_id===userId); return m?.profile?.display_name || (userId===state.user?.id ? displayName(state.profile,state.user) : 'Other person'); }

async function init(){
  if(!sb){ showOnly('signedOutView'); showToast('Missing Supabase config.'); return; }
  const { data } = await sb.auth.getSession();
  state.user = data.session?.user || null;
  sb.auth.onAuthStateChange((_event, session)=>{ state.user = session?.user || null; bootForUser(); });
  await bootForUser();
}

async function bootForUser(){
  els.loginBtn.classList.toggle('hidden', !!state.user);
  els.logoutBtn.classList.toggle('hidden', !state.user);
  els.userBadge.classList.toggle('hidden', !state.user);
  els.setupView.classList.add('hidden');
  if(!state.user){ showOnly('signedOutView'); return; }
  els.userBadge.textContent = displayName(state.profile,state.user);
  showOnly('loadingView');
  await loadProfile();
  if(!state.profile){
    els.displayNameInput.value = displayName(null,state.user);
    els.setupView.classList.remove('hidden'); showOnly(null); return;
  }
  els.userBadge.textContent = displayName(state.profile,state.user);
  const sessionFromUrl = new URL(location.href).searchParams.get('session');
  if(sessionFromUrl){ await openSession(sessionFromUrl, true); }
  else { await loadSessions(); showOnly('homeView'); }
}

async function loadProfile(){
  const { data, error } = await sb.from('bcc_profiles').select('*').eq('user_id', state.user.id).maybeSingle();
  if(error) console.warn(error); state.profile = data || null;
}
async function saveProfile(){
  const name = els.displayNameInput.value.trim(); if(!name) return showToast('Enter a display name.');
  const { data, error } = await sb.from('bcc_profiles').upsert({ user_id: state.user.id, display_name:name, email:state.user.email }, { onConflict:'user_id' }).select().single();
  if(error) return showToast(error.message);
  state.profile=data; showToast('Profile saved.'); await bootForUser();
}
async function login(){
  const redirectTo = location.href;
  const { error } = await sb.auth.signInWithOAuth({ provider:'google', options:{ redirectTo } });
  if(error) showToast(error.message);
}
async function logout(){ await sb.auth.signOut(); }

async function createSession(){
  const title = `${displayName(state.profile,state.user)}'s Bedroom Connection Builder`;
  const { data, error } = await sb.from('bcc_sessions').insert({ owner_id:state.user.id, title }).select().single();
  if(error) return showToast(error.message);
  await sb.from('bcc_session_members').insert({ session_id:data.id, user_id:state.user.id, role:'owner' });
  history.pushState(null,'',appUrlForSession(data.id));
  await openSession(data.id, false);
}

async function loadSessions(){
  const membersRes = await sb.from('bcc_session_members').select('session_id, role, created_at').eq('user_id', state.user.id).order('created_at',{ascending:false});
  if(membersRes.error){ showToast(membersRes.error.message); return; }
  const memberships = membersRes.data || [];
  const ids = [...new Set(memberships.map(row => row.session_id).filter(Boolean))];
  let sessionMap = {};
  if(ids.length){
    const sessionsRes = await sb.from('bcc_sessions').select('id, owner_id, title, created_at, updated_at').in('id', ids);
    if(sessionsRes.error){ showToast(sessionsRes.error.message); return; }
    sessionMap = Object.fromEntries((sessionsRes.data || []).map(s => [s.id, s]));
  }
  state.sessions = memberships.map(row => ({ ...row, session: sessionMap[row.session_id] })).filter(row => row.session);
  renderSessionList();
}
function renderSessionList(){
  els.sessionList.innerHTML = '';
  if(!state.sessions.length){ els.sessionList.innerHTML = '<p class="muted">No builders yet. Create one and send the invite link.</p>'; return; }
  state.sessions.forEach(row=>{
    const s=row.session;
    const div=document.createElement('div'); div.className='session-item';
    div.innerHTML=`<div><strong>${escapeHtml(s.title||'Bedroom Connection Builder')}</strong><span class="muted small">${new Date(s.created_at).toLocaleDateString()}</span></div><button class="btn ghost">Open</button>`;
    div.querySelector('button').onclick=()=>{ history.pushState(null,'',appUrlForSession(s.id)); openSession(s.id,false); };
    els.sessionList.appendChild(div);
  });
}

async function openSession(id, joining){
  showOnly('loadingView');
  const { data: session, error } = await sb.from('bcc_sessions').select('*').eq('id', id).maybeSingle();
  if(error || !session){ showToast('Could not open that connection builder.'); history.replaceState(null,'',location.pathname); await loadSessions(); showOnly('homeView'); return; }
  const { data: existing } = await sb.from('bcc_session_members').select('*').eq('session_id',id).eq('user_id',state.user.id).maybeSingle();
  if(!existing){
    const { count } = await sb.from('bcc_session_members').select('*',{count:'exact',head:true}).eq('session_id',id);
    if(count >= 2){ showToast('This connection builder already has two people.'); history.replaceState(null,'',location.pathname); await loadSessions(); showOnly('homeView'); return; }
    const { error: joinErr } = await sb.from('bcc_session_members').insert({ session_id:id, user_id:state.user.id, role:'partner' });
    if(joinErr){ showToast(joinErr.message); return; }
    if(joining) showToast('Joined connection builder.');
  }
  state.activeSession=session;
  await refreshSessionData();
  subscribeSession(id);
  showOnly('sessionView');
  renderSession();
}

async function refreshSessionData(){
  const id=state.activeSession.id;
  const [membersRes, answersRes] = await Promise.all([
    sb.from('bcc_session_members').select('*').eq('session_id',id).order('created_at'),
    sb.from('bcc_answers').select('*').eq('session_id',id)
  ]);

  if(membersRes.error) {
    console.warn(membersRes.error);
    showToast(membersRes.error.message || 'Could not load builder members.');
  }
  if(answersRes.error) {
    console.warn(answersRes.error);
    showToast(answersRes.error.message || 'Could not load answers.');
  }

  const members = membersRes.data || [];
  const userIds = [...new Set(members.map(m => m.user_id).filter(Boolean))];
  let profileMap = {};

  if(userIds.length){
    const profilesRes = await sb.from('bcc_profiles').select('user_id, display_name, email').in('user_id', userIds);
    if(profilesRes.error) {
      console.warn(profilesRes.error);
    } else {
      profileMap = Object.fromEntries((profilesRes.data || []).map(p => [p.user_id, p]));
    }
  }

  state.members = members.map(m => ({ ...m, profile: profileMap[m.user_id] || null }));
  state.answers = answersRes.data || [];
}
function subscribeSession(id){
  if(state.channel) sb.removeChannel(state.channel);
  state.channel = sb.channel(`bcc-${id}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'bcc_answers',filter:`session_id=eq.${id}`}, async()=>{ els.syncStatus.textContent='Updated just now'; await refreshSessionData(); renderSession(); })
    .on('postgres_changes',{event:'*',schema:'public',table:'bcc_session_members',filter:`session_id=eq.${id}`}, async()=>{ await refreshSessionData(); renderSession(); })
    .subscribe(status=>{ els.syncStatus.textContent = status === 'SUBSCRIBED' ? 'Live sync active' : 'Connecting live sync…'; });
}

function renderSession(){
  const s=state.activeSession; if(!s) return;
  els.sessionTitle.textContent=s.title || 'Bedroom Connection Builder';
  const otherPerson = state.members.find(m=>m.user_id!==state.user.id);
  els.partnerLine.textContent = otherPerson ? `Connected with ${participantName(otherPerson.user_id)}` : 'Waiting for the other person to join from the invite link.';
  els.inviteLinkInput.value=appUrlForSession(s.id);
  els.inviteBox.classList.toggle('hidden', !!otherPerson);
  els.questionArea.classList.toggle('card-mode', state.cardMode);
  els.toggleViewBtn.textContent = state.cardMode ? 'List view' : 'Card view';
  renderProgress(); renderQuestions();
}
function answersFor(qid){ return state.answers.filter(a=>a.question_id===qid); }
function myAnswer(qid){ return state.answers.find(a=>a.question_id===qid && a.user_id===state.user.id); }
function renderProgress(){
  const both = QUESTIONS.filter(q=>answersFor(q.id).length>=2).length;
  els.progressText.textContent = `${both} of ${QUESTIONS.length} answered by both people`;
  els.progressBar.style.width = `${Math.round((both/QUESTIONS.length)*100)}%`;
  if(both === QUESTIONS.length){
    const matches = QUESTIONS.filter(q=>{ const a=answersFor(q.id); return isCompatible(q,a[0],a[1]); }).length;
    const pct = Math.round((matches / QUESTIONS.length) * 100);
    els.finalScoreCard.classList.remove('hidden');
    els.finalScoreCard.innerHTML = `<p class="eyebrow">Final reveal</p><h2>Compatibility Score</h2><div class="score-number">${pct}%</div><p class="muted">${matches} positive compatibility cards and ${QUESTIONS.length-matches} mismatch cards.</p>`;
  } else els.finalScoreCard.classList.add('hidden');
}
function renderQuestions(){
  els.questionArea.innerHTML='';
  QUESTIONS.forEach((q,i)=>{
    const all=answersFor(q.id); const mine=myAnswer(q.id); const both=all.length>=2; const comp=both ? isCompatible(q,all[0],all[1]) : null;
    const cls = both ? (comp?'match':'miss') : 'waiting';
    const status = both ? (comp?'Compatible':'Not compatible') : (mine?'Waiting for the other person':'Your answer needed');
    const div=document.createElement('article'); div.className=`q-card ${cls}`;
    div.innerHTML=`
      <div class="q-head"><span class="q-category">${i+1}. ${escapeHtml(q.category)}</span><span class="status-pill ${cls}">${status}</span></div>
      <div class="q-text">${escapeHtml(q.text)}</div>
      <div class="choices">${q.options.map(opt=>`<button class="choice ${mine?.answer_value===opt?'selected':''}" data-value="${escapeAttr(opt)}">${escapeHtml(opt)}</button>`).join('')}</div>
      ${both ? `<div class="reveal"><strong>${comp?'Overlap found':'Mismatch found'}:</strong> ${escapeHtml(participantName(all[0].user_id))} chose “${escapeHtml(all[0].answer_value)}” and ${escapeHtml(participantName(all[1].user_id))} chose “${escapeHtml(all[1].answer_value)}”.</div>` : `<div class="reveal">${mine?'Your answer is saved. The other person can answer later.':'Choose your answer privately.'}</div>`}
    `;
    div.querySelectorAll('.choice').forEach(btn=>btn.onclick=()=>saveAnswer(q.id, btn.dataset.value));
    els.questionArea.appendChild(div);
  });
}
async function saveAnswer(question_id, answer_value){
  const { error } = await sb.from('bcc_answers').upsert({ session_id:state.activeSession.id, user_id:state.user.id, question_id, answer_value }, { onConflict:'session_id,user_id,question_id' });
  if(error) return showToast(error.message);
  await refreshSessionData(); renderSession();
}
async function copyInvite(){ await navigator.clipboard.writeText(appUrlForSession(state.activeSession.id)); showToast('Invite link copied.'); }
function goHome(){ if(state.channel) sb.removeChannel(state.channel); state.activeSession=null; history.pushState(null,'',location.pathname); loadSessions().then(()=>showOnly('homeView')); }
function escapeHtml(s=''){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function escapeAttr(s=''){ return escapeHtml(s).replace(/`/g,'&#96;'); }

els.loginBtn.onclick=login; els.logoutBtn.onclick=logout; els.saveProfileBtn.onclick=saveProfile; els.createSessionBtn.onclick=createSession; els.backBtn.onclick=goHome; els.copyInviteBtn.onclick=copyInvite; els.copyInviteBtn2.onclick=copyInvite; els.toggleViewBtn.onclick=()=>{state.cardMode=!state.cardMode;renderSession();};
window.addEventListener('popstate',()=>bootForUser());
init();
})();
