(() => {
  'use strict';
  if (window.__BEDROOM_CONNECTION_APP_LOADED__) return;
  window.__BEDROOM_CONNECTION_APP_LOADED__ = true;

  const CONFIG = window.COMPAT_CONFIG || window.TRIP_CONFIG || {};
  const sb = window.supabase?.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_PUBLISHABLE_KEY || CONFIG.SUPABASE_ANON_KEY);

  const ANSWER_TYPES = {
    attraction: [
      { label:'😍 Huge Turn-On', score:4, heat:true },
      { label:'😊 Sexy', score:3, heat:true },
      { label:'😏 Kinda Into It', score:2, curious:true },
      { label:'😐 Meh', score:1 },
      { label:'👎 Not My Thing', score:0, hardNo:true }
    ],
    affection: [
      { label:'❤️ Love It', score:4, heat:true },
      { label:'😊 Enjoy It', score:3, heat:true },
      { label:'😏 Sometimes', score:2, curious:true },
      { label:'😐 Meh', score:1 },
      { label:'🙅 Not For Me', score:0, hardNo:true }
    ],
    style: [
      { label:'🔥 Favorite', score:4, heat:true },
      { label:'😈 Very Into It', score:3, heat:true },
      { label:'🤔 Depends', score:2, curious:true },
      { label:'😐 Meh', score:1 },
      { label:'🚫 Not For Me', score:0, hardNo:true }
    ],
    desire: [
      { label:'🔥 Yes Please', score:4, heat:true },
      { label:'😘 Into It', score:3, heat:true },
      { label:'👀 Curious', score:2, curious:true },
      { label:'😐 Meh', score:1 },
      { label:'🚫 Avoid It', score:0, hardNo:true }
    ],
    exploration: [
      { label:'🔥 Absolutely', score:4, heat:true },
      { label:'👀 Curious', score:3, curious:true },
      { label:'🤔 Maybe', score:2, curious:true },
      { label:'😐 Not Sure', score:1 },
      { label:'🚫 No Thanks', score:0, hardNo:true }
    ],
    experience: [
      { label:'✅ Loved It', score:4, heat:true },
      { label:'👍 Enjoyed It', score:3, heat:true },
      { label:'👀 Curious', score:2, curious:true },
      { label:'😶 Never Tried', score:1 },
      { label:'👎 Didn’t Enjoy', score:0, hardNo:true }
    ],
    frequency: [
      { label:'🔥 All The Time', score:4, heat:true },
      { label:'😊 Often', score:3, heat:true },
      { label:'😏 Sometimes', score:2, curious:true },
      { label:'😐 Rarely', score:1 },
      { label:'🚫 Never', score:0, hardNo:true }
    ]
  };

  const QUESTIONS = [
  {
    "id": "attraction___chemistry_1_confidence_in_the_be",
    "category": "Attraction & Chemistry",
    "type": "attraction",
    "text": "Confidence in the bedroom is a huge turn-on."
  },
  {
    "id": "attraction___chemistry_2_playful_teasing_gets",
    "category": "Attraction & Chemistry",
    "type": "attraction",
    "text": "Playful teasing gets me excited."
  },
  {
    "id": "attraction___chemistry_3_strong_eye_contact_f",
    "category": "Attraction & Chemistry",
    "type": "attraction",
    "text": "Strong eye contact feels sexy."
  },
  {
    "id": "attraction___chemistry_4_being_pursued_makes",
    "category": "Attraction & Chemistry",
    "type": "attraction",
    "text": "Being pursued makes me feel wanted."
  },
  {
    "id": "attraction___chemistry_5_taking_the_lead_is_a",
    "category": "Attraction & Chemistry",
    "type": "attraction",
    "text": "Taking the lead is attractive to me."
  },
  {
    "id": "attraction___chemistry_6_i_like_when_someone",
    "category": "Attraction & Chemistry",
    "type": "attraction",
    "text": "I like when someone dresses up with bedroom energy in mind."
  },
  {
    "id": "attraction___chemistry_7_a_seductive_voice_or",
    "category": "Attraction & Chemistry",
    "type": "attraction",
    "text": "A seductive voice or tone turns me on."
  },
  {
    "id": "attraction___chemistry_8_dirty_compliments_ar",
    "category": "Attraction & Chemistry",
    "type": "attraction",
    "text": "Dirty compliments are exciting."
  },
  {
    "id": "attraction___chemistry_9_flirty_tension_befor",
    "category": "Attraction & Chemistry",
    "type": "attraction",
    "text": "Flirty tension before anything physical is hot."
  },
  {
    "id": "attraction___chemistry_10_i_like_bold__direct",
    "category": "Attraction & Chemistry",
    "type": "attraction",
    "text": "I like bold, direct desire."
  },
  {
    "id": "attraction___chemistry_11_i_like_a_slower__mys",
    "category": "Attraction & Chemistry",
    "type": "attraction",
    "text": "I like a slower, mysterious build-up."
  },
  {
    "id": "attraction___chemistry_12_playful_confidence_i",
    "category": "Attraction & Chemistry",
    "type": "attraction",
    "text": "Playful confidence is more attractive than perfection."
  },
  {
    "id": "attraction___chemistry_13_a_little_possessive",
    "category": "Attraction & Chemistry",
    "type": "attraction",
    "text": "A little possessive energy can be sexy when it feels mutual."
  },
  {
    "id": "attraction___chemistry_14_i_like_being_made_to",
    "category": "Attraction & Chemistry",
    "type": "attraction",
    "text": "I like being made to feel irresistible."
  },
  {
    "id": "kissing___touch_1_long_kissing_session",
    "category": "Kissing & Touch",
    "type": "affection",
    "text": "Long kissing sessions are a favorite."
  },
  {
    "id": "kissing___touch_2_slow_kissing_before",
    "category": "Kissing & Touch",
    "type": "affection",
    "text": "Slow kissing before anything more is important to me."
  },
  {
    "id": "kissing___touch_3_passionate_kissing_t",
    "category": "Kissing & Touch",
    "type": "affection",
    "text": "Passionate kissing turns me on quickly."
  },
  {
    "id": "kissing___touch_4_neck_kisses_are_a_ma",
    "category": "Kissing & Touch",
    "type": "affection",
    "text": "Neck kisses are a major turn-on."
  },
  {
    "id": "kissing___touch_5_being_touched_slowly",
    "category": "Kissing & Touch",
    "type": "affection",
    "text": "Being touched slowly feels sexy."
  },
  {
    "id": "kissing___touch_6_i_like_hands_on_affe",
    "category": "Kissing & Touch",
    "type": "affection",
    "text": "I like hands-on affection throughout the day."
  },
  {
    "id": "kissing___touch_7_cuddling_after_intim",
    "category": "Kissing & Touch",
    "type": "affection",
    "text": "Cuddling after intimacy matters to me."
  },
  {
    "id": "kissing___touch_8_i_enjoy_being_held_c",
    "category": "Kissing & Touch",
    "type": "affection",
    "text": "I enjoy being held close."
  },
  {
    "id": "kissing___touch_9_i_like_playful_touch",
    "category": "Kissing & Touch",
    "type": "affection",
    "text": "I like playful touching and teasing."
  },
  {
    "id": "kissing___touch_10_i_like_gentle_touch",
    "category": "Kissing & Touch",
    "type": "affection",
    "text": "I like gentle touch more than rough touch."
  },
  {
    "id": "kissing___touch_11_i_like_intense_touch",
    "category": "Kissing & Touch",
    "type": "affection",
    "text": "I like intense touch when the mood is right."
  },
  {
    "id": "kissing___touch_12_i_enjoy_massages_as",
    "category": "Kissing & Touch",
    "type": "affection",
    "text": "I enjoy massages as part of bedroom connection."
  },
  {
    "id": "kissing___touch_13_i_like_affectionate",
    "category": "Kissing & Touch",
    "type": "affection",
    "text": "I like affectionate touch in public."
  },
  {
    "id": "kissing___touch_14_i_like_private_affec",
    "category": "Kissing & Touch",
    "type": "affection",
    "text": "I like private affection more than public affection."
  },
  {
    "id": "bedroom_style_1_slow_and_romantic_is",
    "category": "Bedroom Style",
    "type": "style",
    "text": "Slow and romantic is my ideal pace."
  },
  {
    "id": "bedroom_style_2_playful_and_fun_is_m",
    "category": "Bedroom Style",
    "type": "style",
    "text": "Playful and fun is my ideal bedroom energy."
  },
  {
    "id": "bedroom_style_3_passionate_and_inten",
    "category": "Bedroom Style",
    "type": "style",
    "text": "Passionate and intense is my ideal bedroom energy."
  },
  {
    "id": "bedroom_style_4_spontaneous_moments",
    "category": "Bedroom Style",
    "type": "style",
    "text": "Spontaneous moments excite me."
  },
  {
    "id": "bedroom_style_5_planned_special_nigh",
    "category": "Bedroom Style",
    "type": "style",
    "text": "Planned special nights can be very sexy."
  },
  {
    "id": "bedroom_style_6_i_like_building_anti",
    "category": "Bedroom Style",
    "type": "style",
    "text": "I like building anticipation for hours before."
  },
  {
    "id": "bedroom_style_7_i_like_a_mix_of_swee",
    "category": "Bedroom Style",
    "type": "style",
    "text": "I like a mix of sweet and dirty."
  },
  {
    "id": "bedroom_style_8_i_enjoy_variety_inst",
    "category": "Bedroom Style",
    "type": "style",
    "text": "I enjoy variety instead of the same routine."
  },
  {
    "id": "bedroom_style_9_i_like_familiar_favo",
    "category": "Bedroom Style",
    "type": "style",
    "text": "I like familiar favorites done really well."
  },
  {
    "id": "bedroom_style_10_i_enjoy_taking_turns",
    "category": "Bedroom Style",
    "type": "style",
    "text": "I enjoy taking turns leading."
  },
  {
    "id": "bedroom_style_11_i_like_being_guided",
    "category": "Bedroom Style",
    "type": "style",
    "text": "I like being guided by the other person."
  },
  {
    "id": "bedroom_style_12_i_like_guiding_the_o",
    "category": "Bedroom Style",
    "type": "style",
    "text": "I like guiding the other person."
  },
  {
    "id": "bedroom_style_13_i_enjoy_teasing_befo",
    "category": "Bedroom Style",
    "type": "style",
    "text": "I enjoy teasing before giving in."
  },
  {
    "id": "bedroom_style_14_i_like_a_confident",
    "category": "Bedroom Style",
    "type": "style",
    "text": "I like a confident, take-charge vibe."
  },
  {
    "id": "desire___communication_1_flirty_texts_during",
    "category": "Desire & Communication",
    "type": "desire",
    "text": "Flirty texts during the day turn me on."
  },
  {
    "id": "desire___communication_2_voice_messages_can_b",
    "category": "Desire & Communication",
    "type": "desire",
    "text": "Voice messages can be very sexy."
  },
  {
    "id": "desire___communication_3_i_like_being_told_ex",
    "category": "Desire & Communication",
    "type": "desire",
    "text": "I like being told exactly what someone wants."
  },
  {
    "id": "desire___communication_4_i_like_telling_someo",
    "category": "Desire & Communication",
    "type": "desire",
    "text": "I like telling someone exactly what I want."
  },
  {
    "id": "desire___communication_5_i_enjoy_talking_abou",
    "category": "Desire & Communication",
    "type": "desire",
    "text": "I enjoy talking about fantasies."
  },
  {
    "id": "desire___communication_6_i_like_being_asked_w",
    "category": "Desire & Communication",
    "type": "desire",
    "text": "I like being asked what feels good."
  },
  {
    "id": "desire___communication_7_i_like_giving_feedba",
    "category": "Desire & Communication",
    "type": "desire",
    "text": "I like giving feedback in the moment."
  },
  {
    "id": "desire___communication_8_i_like_receiving_fee",
    "category": "Desire & Communication",
    "type": "desire",
    "text": "I like receiving feedback in the moment."
  },
  {
    "id": "desire___communication_9_i_enjoy_playful_sext",
    "category": "Desire & Communication",
    "type": "desire",
    "text": "I enjoy playful sexting when apart."
  },
  {
    "id": "desire___communication_10_i_enjoy_suggestive_p",
    "category": "Desire & Communication",
    "type": "desire",
    "text": "I enjoy suggestive photos when trust is already there."
  },
  {
    "id": "desire___communication_11_i_like_building_anti",
    "category": "Desire & Communication",
    "type": "desire",
    "text": "I like building anticipation before meeting up."
  },
  {
    "id": "desire___communication_12_i_like_direct_invita",
    "category": "Desire & Communication",
    "type": "desire",
    "text": "I like direct invitations instead of hints."
  },
  {
    "id": "exploration___curiosity_1_trying_new_bedroom_i",
    "category": "Exploration & Curiosity",
    "type": "exploration",
    "text": "Trying new bedroom ideas together sounds exciting."
  },
  {
    "id": "exploration___curiosity_2_fantasy_discussion_s",
    "category": "Exploration & Curiosity",
    "type": "exploration",
    "text": "Fantasy discussion sounds exciting."
  },
  {
    "id": "exploration___curiosity_3_romantic_roleplay_so",
    "category": "Exploration & Curiosity",
    "type": "exploration",
    "text": "Romantic roleplay sounds exciting."
  },
  {
    "id": "exploration___curiosity_4_playful_costumes_or",
    "category": "Exploration & Curiosity",
    "type": "exploration",
    "text": "Playful costumes or outfits sound exciting."
  },
  {
    "id": "exploration___curiosity_5_using_toys_together",
    "category": "Exploration & Curiosity",
    "type": "exploration",
    "text": "Using toys together sounds exciting."
  },
  {
    "id": "exploration___curiosity_6_light_sensory_play_s",
    "category": "Exploration & Curiosity",
    "type": "exploration",
    "text": "Light sensory play sounds exciting."
  },
  {
    "id": "exploration___curiosity_7_blindfold_style_anti",
    "category": "Exploration & Curiosity",
    "type": "exploration",
    "text": "Blindfold-style anticipation sounds exciting."
  },
  {
    "id": "exploration___curiosity_8_taking_turns_being_i",
    "category": "Exploration & Curiosity",
    "type": "exploration",
    "text": "Taking turns being in control sounds exciting."
  },
  {
    "id": "exploration___curiosity_9_power_exchange_energ",
    "category": "Exploration & Curiosity",
    "type": "exploration",
    "text": "Power-exchange energy sounds exciting when mutual."
  },
  {
    "id": "exploration___curiosity_10_being_more_dominant",
    "category": "Exploration & Curiosity",
    "type": "exploration",
    "text": "Being more dominant sounds exciting."
  },
  {
    "id": "exploration___curiosity_11_being_more_submissiv",
    "category": "Exploration & Curiosity",
    "type": "exploration",
    "text": "Being more submissive sounds exciting."
  },
  {
    "id": "exploration___curiosity_12_switching_between_do",
    "category": "Exploration & Curiosity",
    "type": "exploration",
    "text": "Switching between dominant and submissive energy sounds exciting."
  },
  {
    "id": "exploration___curiosity_13_exploring_praise_and",
    "category": "Exploration & Curiosity",
    "type": "exploration",
    "text": "Exploring praise and admiration sounds exciting."
  },
  {
    "id": "exploration___curiosity_14_exploring_teasing_an",
    "category": "Exploration & Curiosity",
    "type": "exploration",
    "text": "Exploring teasing and denial energy sounds exciting."
  },
  {
    "id": "exploration___curiosity_15_exploring_a_hotel_ni",
    "category": "Exploration & Curiosity",
    "type": "exploration",
    "text": "Exploring a hotel-night fantasy sounds exciting."
  },
  {
    "id": "exploration___curiosity_16_exploring_vacation_i",
    "category": "Exploration & Curiosity",
    "type": "exploration",
    "text": "Exploring vacation intimacy sounds exciting."
  },
  {
    "id": "exploration___curiosity_17_exploring_a_spontane",
    "category": "Exploration & Curiosity",
    "type": "exploration",
    "text": "Exploring a spontaneous quick moment sounds exciting."
  },
  {
    "id": "exploration___curiosity_18_trying_a_new_positio",
    "category": "Exploration & Curiosity",
    "type": "exploration",
    "text": "Trying a new position sounds exciting."
  },
  {
    "id": "positions___pace_1_face_to_face_positio",
    "category": "Positions & Pace",
    "type": "exploration",
    "text": "Face-to-face positions feel especially intimate."
  },
  {
    "id": "positions___pace_2_positions_with_stron",
    "category": "Positions & Pace",
    "type": "exploration",
    "text": "Positions with strong eye contact are appealing."
  },
  {
    "id": "positions___pace_3_positions_that_feel",
    "category": "Positions & Pace",
    "type": "exploration",
    "text": "Positions that feel dominant or controlled are appealing."
  },
  {
    "id": "positions___pace_4_positions_that_feel",
    "category": "Positions & Pace",
    "type": "exploration",
    "text": "Positions that feel slow and sensual are appealing."
  },
  {
    "id": "positions___pace_5_positions_that_feel",
    "category": "Positions & Pace",
    "type": "exploration",
    "text": "Positions that feel intense and energetic are appealing."
  },
  {
    "id": "positions___pace_6_being_on_top_sounds",
    "category": "Positions & Pace",
    "type": "exploration",
    "text": "Being on top sounds appealing."
  },
  {
    "id": "positions___pace_7_having_the_other_per",
    "category": "Positions & Pace",
    "type": "exploration",
    "text": "Having the other person on top sounds appealing."
  },
  {
    "id": "positions___pace_8_standing_or_against",
    "category": "Positions & Pace",
    "type": "exploration",
    "text": "Standing or against-the-wall energy sounds appealing."
  },
  {
    "id": "positions___pace_9_lazy_morning_intimac",
    "category": "Positions & Pace",
    "type": "exploration",
    "text": "Lazy morning intimacy sounds appealing."
  },
  {
    "id": "positions___pace_10_long__drawn_out_sess",
    "category": "Positions & Pace",
    "type": "exploration",
    "text": "Long, drawn-out sessions sound appealing."
  },
  {
    "id": "positions___pace_11_quick__heated_moment",
    "category": "Positions & Pace",
    "type": "exploration",
    "text": "Quick, heated moments sound appealing."
  },
  {
    "id": "positions___pace_12_changing_positions_o",
    "category": "Positions & Pace",
    "type": "exploration",
    "text": "Changing positions often sounds appealing."
  },
  {
    "id": "oral___pleasure_focus_1_giving_oral_pleasure",
    "category": "Oral & Pleasure Focus",
    "type": "experience",
    "text": "Giving oral pleasure is something I enjoy or want to explore."
  },
  {
    "id": "oral___pleasure_focus_2_receiving_oral_pleas",
    "category": "Oral & Pleasure Focus",
    "type": "experience",
    "text": "Receiving oral pleasure is something I enjoy or want to explore."
  },
  {
    "id": "oral___pleasure_focus_3_taking_time_with_for",
    "category": "Oral & Pleasure Focus",
    "type": "experience",
    "text": "Taking time with foreplay is important to me."
  },
  {
    "id": "oral___pleasure_focus_4_i_enjoy_focusing_on",
    "category": "Oral & Pleasure Focus",
    "type": "experience",
    "text": "I enjoy focusing on my partner’s pleasure."
  },
  {
    "id": "oral___pleasure_focus_5_i_enjoy_when_my_plea",
    "category": "Oral & Pleasure Focus",
    "type": "experience",
    "text": "I enjoy when my pleasure is focused on."
  },
  {
    "id": "oral___pleasure_focus_6_i_like_learning_exac",
    "category": "Oral & Pleasure Focus",
    "type": "experience",
    "text": "I like learning exactly what works for the other person."
  },
  {
    "id": "oral___pleasure_focus_7_i_like_being_shown_w",
    "category": "Oral & Pleasure Focus",
    "type": "experience",
    "text": "I like being shown what works for me."
  },
  {
    "id": "oral___pleasure_focus_8_i_enjoy_a_slower_ple",
    "category": "Oral & Pleasure Focus",
    "type": "experience",
    "text": "I enjoy a slower pleasure-focused pace."
  },
  {
    "id": "oral___pleasure_focus_9_i_enjoy_a_more_eager",
    "category": "Oral & Pleasure Focus",
    "type": "experience",
    "text": "I enjoy a more eager, hungry energy."
  },
  {
    "id": "oral___pleasure_focus_10_i_like_when_pleasure",
    "category": "Oral & Pleasure Focus",
    "type": "experience",
    "text": "I like when pleasure feels mutual and balanced."
  },
  {
    "id": "oral___pleasure_focus_11_i_like_being_praised",
    "category": "Oral & Pleasure Focus",
    "type": "experience",
    "text": "I like being praised for what I do well."
  },
  {
    "id": "oral___pleasure_focus_12_i_like_giving_praise",
    "category": "Oral & Pleasure Focus",
    "type": "experience",
    "text": "I like giving praise when something feels good."
  },
  {
    "id": "kinks___power_dynamics_1_praise_focused_bedro",
    "category": "Kinks & Power Dynamics",
    "type": "exploration",
    "text": "Praise-focused bedroom energy turns me on."
  },
  {
    "id": "kinks___power_dynamics_2_dirty_talk_turns_me",
    "category": "Kinks & Power Dynamics",
    "type": "exploration",
    "text": "Dirty talk turns me on."
  },
  {
    "id": "kinks___power_dynamics_3_light_roughness_soun",
    "category": "Kinks & Power Dynamics",
    "type": "exploration",
    "text": "Light roughness sounds exciting when mutual."
  },
  {
    "id": "kinks___power_dynamics_4_hair_pulling_sounds",
    "category": "Kinks & Power Dynamics",
    "type": "exploration",
    "text": "Hair pulling sounds exciting when mutual."
  },
  {
    "id": "kinks___power_dynamics_5_being_pinned_down_so",
    "category": "Kinks & Power Dynamics",
    "type": "exploration",
    "text": "Being pinned down sounds exciting when mutual."
  },
  {
    "id": "kinks___power_dynamics_6_pinning_someone_down",
    "category": "Kinks & Power Dynamics",
    "type": "exploration",
    "text": "Pinning someone down sounds exciting when mutual."
  },
  {
    "id": "kinks___power_dynamics_7_light_spanking_sound",
    "category": "Kinks & Power Dynamics",
    "type": "exploration",
    "text": "Light spanking sounds exciting when mutual."
  },
  {
    "id": "kinks___power_dynamics_8_being_told_what_to_d",
    "category": "Kinks & Power Dynamics",
    "type": "exploration",
    "text": "Being told what to do sounds exciting when mutual."
  },
  {
    "id": "kinks___power_dynamics_9_telling_someone_what",
    "category": "Kinks & Power Dynamics",
    "type": "exploration",
    "text": "Telling someone what to do sounds exciting when mutual."
  },
  {
    "id": "kinks___power_dynamics_10_begging_or_being_beg",
    "category": "Kinks & Power Dynamics",
    "type": "exploration",
    "text": "Begging or being begged for sounds exciting."
  },
  {
    "id": "kinks___power_dynamics_11_jealous_or_possessiv",
    "category": "Kinks & Power Dynamics",
    "type": "exploration",
    "text": "Jealous or possessive fantasy energy sounds exciting when clearly playful."
  },
  {
    "id": "kinks___power_dynamics_12_bossy_bedroom_energy",
    "category": "Kinks & Power Dynamics",
    "type": "exploration",
    "text": "Bossy bedroom energy sounds exciting."
  },
  {
    "id": "kinks___power_dynamics_13_soft_dominance_sound",
    "category": "Kinks & Power Dynamics",
    "type": "exploration",
    "text": "Soft dominance sounds exciting."
  },
  {
    "id": "kinks___power_dynamics_14_bratty_teasing_sound",
    "category": "Kinks & Power Dynamics",
    "type": "exploration",
    "text": "Bratty teasing sounds exciting."
  },
  {
    "id": "settings___atmosphere_1_luxury_hotel_energy",
    "category": "Settings & Atmosphere",
    "type": "attraction",
    "text": "Luxury hotel energy is a turn-on."
  },
  {
    "id": "settings___atmosphere_2_vacation_intimacy_is",
    "category": "Settings & Atmosphere",
    "type": "attraction",
    "text": "Vacation intimacy is a turn-on."
  },
  {
    "id": "settings___atmosphere_3_candlelight_and_musi",
    "category": "Settings & Atmosphere",
    "type": "attraction",
    "text": "Candlelight and music set the mood for me."
  },
  {
    "id": "settings___atmosphere_4_dim_lighting_feels_s",
    "category": "Settings & Atmosphere",
    "type": "attraction",
    "text": "Dim lighting feels sexier than bright lighting."
  },
  {
    "id": "settings___atmosphere_5_dressing_up_for_a_pr",
    "category": "Settings & Atmosphere",
    "type": "attraction",
    "text": "Dressing up for a private night feels exciting."
  },
  {
    "id": "settings___atmosphere_6_a_clean__cozy_room_h",
    "category": "Settings & Atmosphere",
    "type": "attraction",
    "text": "A clean, cozy room helps me relax and enjoy it."
  },
  {
    "id": "settings___atmosphere_7_a_dramatic_date_nigh",
    "category": "Settings & Atmosphere",
    "type": "attraction",
    "text": "A dramatic date-night build-up turns me on."
  },
  {
    "id": "frequency___initiation_1_flirting_throughout",
    "category": "Frequency & Initiation",
    "type": "frequency",
    "text": "Flirting throughout the day is something I want."
  },
  {
    "id": "frequency___initiation_2_bedroom_connection_s",
    "category": "Frequency & Initiation",
    "type": "frequency",
    "text": "Bedroom connection several times a week sounds ideal."
  },
  {
    "id": "frequency___initiation_3_morning_intimacy_sou",
    "category": "Frequency & Initiation",
    "type": "frequency",
    "text": "Morning intimacy sounds ideal."
  },
  {
    "id": "frequency___initiation_4_nighttime_intimacy_s",
    "category": "Frequency & Initiation",
    "type": "frequency",
    "text": "Nighttime intimacy sounds ideal."
  },
  {
    "id": "frequency___initiation_5_spontaneous_initiati",
    "category": "Frequency & Initiation",
    "type": "frequency",
    "text": "Spontaneous initiation is something I want."
  },
  {
    "id": "frequency___initiation_6_planned_intimate_nig",
    "category": "Frequency & Initiation",
    "type": "frequency",
    "text": "Planned intimate nights are something I want."
  },
  {
    "id": "frequency___initiation_7_i_like_initiating",
    "category": "Frequency & Initiation",
    "type": "frequency",
    "text": "I like initiating."
  },
  {
    "id": "past_experience___comfort_1_i_have_enjoyed_tryin",
    "category": "Past Experience & Comfort",
    "type": "experience",
    "text": "I have enjoyed trying new positions."
  },
  {
    "id": "past_experience___comfort_2_i_have_enjoyed_using",
    "category": "Past Experience & Comfort",
    "type": "experience",
    "text": "I have enjoyed using toys or accessories."
  },
  {
    "id": "past_experience___comfort_3_i_have_enjoyed_rolep",
    "category": "Past Experience & Comfort",
    "type": "experience",
    "text": "I have enjoyed roleplay or fantasy themes."
  },
  {
    "id": "past_experience___comfort_4_i_have_enjoyed_dirty",
    "category": "Past Experience & Comfort",
    "type": "experience",
    "text": "I have enjoyed dirty talk."
  },
  {
    "id": "past_experience___comfort_5_i_have_enjoyed_power",
    "category": "Past Experience & Comfort",
    "type": "experience",
    "text": "I have enjoyed power-dynamic play."
  },
  {
    "id": "past_experience___comfort_6_i_have_enjoyed_prais",
    "category": "Past Experience & Comfort",
    "type": "experience",
    "text": "I have enjoyed praise-focused energy."
  },
  {
    "id": "past_experience___comfort_7_i_have_enjoyed_rough",
    "category": "Past Experience & Comfort",
    "type": "experience",
    "text": "I have enjoyed rougher energy when mutual."
  },
  {
    "id": "past_experience___comfort_8_i_have_enjoyed_slow",
    "category": "Past Experience & Comfort",
    "type": "experience",
    "text": "I have enjoyed slow romantic intimacy."
  },
  {
    "id": "past_experience___comfort_9_i_have_enjoyed_spont",
    "category": "Past Experience & Comfort",
    "type": "experience",
    "text": "I have enjoyed spontaneous moments."
  },
  {
    "id": "afterglow___repeat_favorites_1_afterward_cuddling_m",
    "category": "Afterglow & Repeat Favorites",
    "type": "style",
    "text": "Afterward cuddling makes the whole experience better."
  },
  {
    "id": "afterglow___repeat_favorites_2_talking_about_favori",
    "category": "Afterglow & Repeat Favorites",
    "type": "style",
    "text": "Talking about favorite moments afterward sounds nice."
  },
  {
    "id": "afterglow___repeat_favorites_3_falling_asleep_close",
    "category": "Afterglow & Repeat Favorites",
    "type": "style",
    "text": "Falling asleep close afterward is ideal."
  },
  {
    "id": "afterglow___repeat_favorites_4_i_like_repeating_wha",
    "category": "Afterglow & Repeat Favorites",
    "type": "style",
    "text": "I like repeating what worked best."
  },
  {
    "id": "afterglow___repeat_favorites_5_i_like_saving_shared",
    "category": "Afterglow & Repeat Favorites",
    "type": "style",
    "text": "I like saving shared favorites for next time."
  },
  {
    "id": "afterglow___repeat_favorites_6_i_like_playful_comme",
    "category": "Afterglow & Repeat Favorites",
    "type": "style",
    "text": "I like playful comments afterward."
  },
  {
    "id": "afterglow___repeat_favorites_7_i_like_being_reassur",
    "category": "Afterglow & Repeat Favorites",
    "type": "style",
    "text": "I like being reassured that the other person enjoyed it."
  }
];

  const $ = id => document.getElementById(id);
  const ids = ['loadingView','signedOutView','setupView','homeView','sessionView','loginBtn','logoutBtn','userBadge','displayNameInput','saveProfileBtn','createSessionBtn','sessionList','backBtn','copyInviteBtn','copyInviteBtn2','inviteLinkInput','inviteBox','sessionTitle','partnerLine','progressText','progressBar','syncStatus','questionArea','finalScoreCard','toggleViewBtn'];
  const els = ids.reduce((a,id)=>(a[id]=$(id),a),{});
  let state = { user:null, profile:null, sessions:[], activeSession:null, members:[], answers:[], channel:null, cardMode:false };

  function escapeHtml(str){ return String(str ?? '').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function toast(msg){ const t=$('toast'); if(!t) return; t.textContent=msg; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'),2400); }
  function showOnly(view){ ['loadingView','signedOutView','homeView','sessionView'].forEach(id=>els[id]?.classList.add('hidden')); if(view) els[view]?.classList.remove('hidden'); }
  function appUrlForSession(id){ const u = new URL(location.href); u.searchParams.set('session', id); return u.toString(); }
  function displayName(profile, user){ return profile?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You'; }
  function participantName(userId){ const m=state.members.find(x=>x.user_id===userId); return m?.profile?.display_name || (userId===state.user?.id ? displayName(state.profile,state.user) : 'Invite'); }
  function getOptions(q){ return ANSWER_TYPES[q.type] || ANSWER_TYPES.exploration; }
  function optionMeta(q, value){ return getOptions(q).find(o=>o.label===value) || null; }
  function myAnswer(qid){ return state.answers.find(a=>a.question_id===qid && a.user_id===state.user?.id); }
  function otherAnswer(qid){ return state.answers.find(a=>a.question_id===qid && a.user_id!==state.user?.id); }
  function compare(q,a,b){
    if(!a || !b) return { kind:'waiting', label: a || b ? 'Waiting for other answer' : 'Not answered yet', compatible:false, points:0 };
    const am=optionMeta(q,a.answer_value), bm=optionMeta(q,b.answer_value);
    if(!am || !bm) return { kind:'waiting', label:'Waiting', compatible:false, points:0 };
    if(am.hardNo || bm.hardNo) return { kind:'miss', label:'Different preferences', compatible:false, points:0 };
    if(am.score>=3 && bm.score>=3) return { kind:'match', label:'Mutual heat', compatible:true, points:1 };
    if(am.score>=2 && bm.score>=2) return { kind:'curious', label:'Shared curiosity', compatible:true, points:.75 };
    if(Math.abs(am.score-bm.score)<=1 && am.score>=1 && bm.score>=1) return { kind:'curious', label:'Possible overlap', compatible:true, points:.5 };
    return { kind:'miss', label:'Different preferences', compatible:false, points:0 };
  }

  async function init(){
    if(!sb){ showOnly('signedOutView'); toast('Missing Supabase config.'); return; }
    const { data } = await sb.auth.getSession();
    state.user = data.session?.user || null;
    sb.auth.onAuthStateChange((_event, session)=>{ state.user = session?.user || null; bootForUser(); });
    bindEvents();
    await bootForUser();
  }

  function bindEvents(){
    els.loginBtn.onclick = login; els.logoutBtn.onclick = logout; els.saveProfileBtn.onclick = saveProfile; els.createSessionBtn.onclick = createSession;
    els.backBtn.onclick = async()=>{ history.replaceState(null,'',location.pathname); if(state.channel) sb.removeChannel(state.channel); await loadSessions(); showOnly('homeView'); };
    els.copyInviteBtn.onclick = showInvite; els.copyInviteBtn2.onclick = copyInvite;
    els.toggleViewBtn.onclick = ()=>{ state.cardMode=!state.cardMode; renderQuestions(); els.toggleViewBtn.textContent = state.cardMode ? 'List view' : 'Card view'; };
  }

  async function bootForUser(){
    els.loginBtn?.classList.toggle('hidden', !!state.user); els.logoutBtn?.classList.toggle('hidden', !state.user); els.userBadge?.classList.toggle('hidden', !state.user); els.setupView?.classList.add('hidden');
    if(!state.user){ showOnly('signedOutView'); return; }
    showOnly('loadingView');
    await loadProfile();
    if(!state.profile){ els.displayNameInput.value = displayName(null,state.user); els.setupView.classList.remove('hidden'); showOnly(null); return; }
    els.userBadge.textContent = displayName(state.profile,state.user);
    const sessionFromUrl = new URL(location.href).searchParams.get('session');
    if(sessionFromUrl) await openSession(sessionFromUrl, true); else { await loadSessions(); showOnly('homeView'); }
  }

  async function loadProfile(){
    const { data, error } = await sb.from('bcc_profiles').select('*').eq('user_id', state.user.id).maybeSingle();
    if(error) console.warn(error); state.profile = data || null;
  }
  async function saveProfile(){
    const name = els.displayNameInput.value.trim(); if(!name) return toast('Enter a display name.');
    const { data, error } = await sb.from('bcc_profiles').upsert({ user_id: state.user.id, display_name:name, email:state.user.email }, { onConflict:'user_id' }).select().single();
    if(error) return toast(error.message); state.profile=data; toast('Profile saved.'); await bootForUser();
  }
  async function login(){ const { error } = await sb.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: location.href } }); if(error) toast(error.message); }
  async function logout(){ if(state.channel) await sb.removeChannel(state.channel); await sb.auth.signOut(); }

  async function createSession(){
    const title = `${displayName(state.profile,state.user)}'s Bedroom Builder`;
    const { data, error } = await sb.from('bcc_sessions').insert({ owner_id:state.user.id, title }).select().single();
    if(error) return toast(error.message);
    const { error: memErr } = await sb.from('bcc_session_members').insert({ session_id:data.id, user_id:state.user.id, role:'owner' });
    if(memErr) return toast(memErr.message);
    history.pushState(null,'',appUrlForSession(data.id)); await openSession(data.id, false);
  }

  async function loadSessions(){
    const { data: rows, error } = await sb.from('bcc_session_members').select('session_id, role, created_at').eq('user_id', state.user.id).order('created_at',{ascending:false});
    if(error){ toast(error.message); return; }
    const ids = [...new Set((rows||[]).map(r=>r.session_id))];
    let sessions=[];
    if(ids.length){ const res = await sb.from('bcc_sessions').select('*').in('id', ids); if(res.error) toast(res.error.message); else sessions=res.data||[]; }
    state.sessions = (rows||[]).map(r=>({...r, session:sessions.find(s=>s.id===r.session_id)})).filter(r=>r.session);
    renderSessionList();
  }
  function renderSessionList(){
    els.sessionList.innerHTML='';
    if(!state.sessions.length){ els.sessionList.innerHTML='<p class="muted">No builders yet. Create one and send the private invite link.</p>'; return; }
    state.sessions.forEach(row=>{ const s=row.session; const div=document.createElement('div'); div.className='session-item';
      div.innerHTML=`<div><strong>${escapeHtml(s.title||'Bedroom Builder')}</strong><span class="muted small">${new Date(s.created_at).toLocaleDateString()}</span></div><button class="btn ghost">Open</button>`;
      div.querySelector('button').onclick=()=>{ history.pushState(null,'',appUrlForSession(s.id)); openSession(s.id,false); }; els.sessionList.appendChild(div);
    });
  }

  async function openSession(id, joining){
    showOnly('loadingView');
    const { data: session, error } = await sb.from('bcc_sessions').select('*').eq('id', id).maybeSingle();
    if(error || !session){ toast('Could not open that builder.'); history.replaceState(null,'',location.pathname); await loadSessions(); showOnly('homeView'); return; }
    const { data: existing } = await sb.from('bcc_session_members').select('*').eq('session_id',id).eq('user_id',state.user.id).maybeSingle();
    if(!existing){
      const { count } = await sb.from('bcc_session_members').select('*',{count:'exact',head:true}).eq('session_id',id);
      if(count >= 2){ toast('This builder already has two people.'); history.replaceState(null,'',location.pathname); await loadSessions(); showOnly('homeView'); return; }
      const { error: joinErr } = await sb.from('bcc_session_members').insert({ session_id:id, user_id:state.user.id, role:'partner' });
      if(joinErr){ toast(joinErr.message); return; } if(joining) toast('Joined builder.');
    }
    state.activeSession=session; await refreshSessionData(); subscribeSession(id); showOnly('sessionView'); renderSession();
  }

  async function refreshSessionData(){
    const id=state.activeSession.id;
    const [membersRes, answersRes] = await Promise.all([
      sb.from('bcc_session_members').select('*').eq('session_id',id).order('created_at',{ascending:true}),
      sb.from('bcc_answers').select('*').eq('session_id',id)
    ]);
    if(membersRes.error) toast(membersRes.error.message); if(answersRes.error) toast(answersRes.error.message);
    const members = membersRes.data || [];
    const userIds = members.map(m=>m.user_id);
    let profiles=[];
    if(userIds.length){ const profilesRes = await sb.from('bcc_profiles').select('*').in('user_id', userIds); if(profilesRes.error) console.warn(profilesRes.error); profiles = profilesRes.data || []; }
    state.members = members.map(m=>({...m, profile:profiles.find(p=>p.user_id===m.user_id)}));
    state.answers = answersRes.data || [];
  }

  function subscribeSession(id){
    if(state.channel) sb.removeChannel(state.channel);
    state.channel = sb.channel(`bedroom-builder-${id}`)
      .on('postgres_changes', {event:'*', schema:'public', table:'bcc_answers', filter:`session_id=eq.${id}`}, async()=>{ els.syncStatus.textContent='Updated live'; await refreshSessionData(); renderSession(); })
      .on('postgres_changes', {event:'*', schema:'public', table:'bcc_session_members', filter:`session_id=eq.${id}`}, async()=>{ await refreshSessionData(); renderSession(); })
      .subscribe(status=>{ els.syncStatus.textContent = status === 'SUBSCRIBED' ? 'Live sync connected' : 'Sync connecting…'; });
  }

  function renderSession(){
    els.sessionTitle.textContent = state.activeSession?.title || 'Bedroom Connection Builder';
    const others=state.members.filter(m=>m.user_id!==state.user.id);
    els.partnerLine.textContent = others.length ? `Connected with ${participantName(others[0].user_id)}` : 'Waiting for invite…';
    renderProgress(); renderFinal(); renderQuestions();
  }
  function renderProgress(){
    const bothAnswered = QUESTIONS.filter(q=>myAnswer(q.id) && otherAnswer(q.id)).length;
    const mine = QUESTIONS.filter(q=>myAnswer(q.id)).length;
    const theirs = QUESTIONS.filter(q=>otherAnswer(q.id)).length;
    els.progressText.textContent = `You: ${mine}/${QUESTIONS.length} • Other: ${theirs}/${QUESTIONS.length} • Both: ${bothAnswered}/${QUESTIONS.length}`;
    els.progressBar.style.width = `${Math.round((bothAnswered/QUESTIONS.length)*100)}%`;
  }
  function renderQuestions(){
    els.questionArea.classList.toggle('card-mode', state.cardMode);
    els.questionArea.innerHTML='';
    QUESTIONS.forEach((q,idx)=>{
      const mine=myAnswer(q.id), theirs=otherAnswer(q.id), c=compare(q,mine,theirs);
      const card=document.createElement('article'); card.className=`q-card ${c.kind}`;
      const choices=getOptions(q).map(o=>`<button class="choice ${mine?.answer_value===o.label?'selected':''}" data-value="${escapeHtml(o.label)}">${escapeHtml(o.label)}</button>`).join('');
      let reveal = '';
      if(mine && theirs) reveal = `<div class="reveal"><strong>Your answer:</strong> ${escapeHtml(mine.answer_value)}<br><strong>${escapeHtml(participantName(theirs.user_id))}:</strong> ${escapeHtml(theirs.answer_value)}</div>`;
      else if(mine) reveal = `<div class="reveal">Your answer is saved. Waiting for the other answer before revealing overlap.</div>`;
      card.innerHTML = `<div class="q-head"><div><div class="q-category">${idx+1} / ${QUESTIONS.length} • ${escapeHtml(q.category)}</div></div><span class="status-pill ${c.kind}">${escapeHtml(c.label)}</span></div><div class="q-text">${escapeHtml(q.text)}</div><div class="choices">${choices}</div>${reveal}`;
      card.querySelectorAll('.choice').forEach(btn=>btn.onclick=()=>saveAnswer(q.id, btn.dataset.value));
      els.questionArea.appendChild(card);
    });
  }
  async function saveAnswer(questionId, answerValue){
    const payload={ session_id:state.activeSession.id, user_id:state.user.id, question_id:questionId, answer_value:answerValue };
    const { error } = await sb.from('bcc_answers').upsert(payload, { onConflict:'session_id,user_id,question_id' });
    if(error) return toast(error.message);
    const existing=state.answers.find(a=>a.session_id===payload.session_id && a.user_id===payload.user_id && a.question_id===payload.question_id);
    if(existing) existing.answer_value=answerValue; else state.answers.push({...payload});
    renderSession();
  }

  function renderFinal(){
    const both = QUESTIONS.map(q=>({q,a:myAnswer(q.id),b:otherAnswer(q.id)})).filter(x=>x.a&&x.b);
    if(both.length < QUESTIONS.length){ els.finalScoreCard.classList.add('hidden'); return; }
    let points=0; const favorites=[], curiosities=[], starters=[], differences=[];
    both.forEach(x=>{ const r=compare(x.q,x.a,x.b); points+=r.points; const am=optionMeta(x.q,x.a.answer_value), bm=optionMeta(x.q,x.b.answer_value);
      if(r.kind==='match') favorites.push(x.q.text); else if(r.kind==='curious') curiosities.push(x.q.text); else differences.push(x.q.text);
      if((am?.score>=3 && bm?.score===2) || (bm?.score>=3 && am?.score===2)) starters.push(x.q.text);
    });
    const score=Math.round((points/QUESTIONS.length)*100);
    const list=arr=>arr.slice(0,6).map(t=>`<li>${escapeHtml(t)}</li>`).join('') || '<li>Nothing here yet.</li>';
    els.finalScoreCard.innerHTML=`<div class="score-grid"><div><p class="eyebrow">Final reveal</p><div class="score-number">${score}%</div><p class="muted">Overall bedroom overlap</p></div><div><h3>Your private results</h3><p class="muted">Built from mutual favorites, shared curiosities, conversation starters, and different preferences.</p><div class="result-columns"><div class="result-box"><h4>🔥 Mutual favorites</h4><ul>${list(favorites)}</ul></div><div class="result-box"><h4>👀 Shared curiosities</h4><ul>${list(curiosities)}</ul></div><div class="result-box"><h4>💬 Conversation starters</h4><ul>${list(starters)}</ul></div><div class="result-box"><h4>⚡ Different preferences</h4><ul>${list(differences)}</ul></div></div></div></div>`;
    els.finalScoreCard.classList.remove('hidden');
  }

  function showInvite(){ els.inviteBox.classList.toggle('hidden'); els.inviteLinkInput.value=appUrlForSession(state.activeSession.id); els.inviteLinkInput.select(); }
  async function copyInvite(){ els.inviteLinkInput.value=appUrlForSession(state.activeSession.id); await navigator.clipboard.writeText(els.inviteLinkInput.value); toast('Invite link copied.'); }
  window.addEventListener('popstate',()=>bootForUser());
  init();
})();
