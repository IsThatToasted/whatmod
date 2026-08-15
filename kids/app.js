const TOTAL_QUESTIONS = 20;

// Scores are intentionally hidden from the interface. Many options are plausible,
// so the quiz measures judgment instead of the ability to spot a cartoonishly bad answer.
const questionBank = [
  {
    id: 'new-friend', minAge: 6, category: 'People', tag: 'New friend',
    q: 'Someone you met in a game has been fun to talk to for a few days. They ask which school you go to.',
    detail: 'They say they are around your age and want to know whether you live nearby.',
    answers: [
      ['Tell them the school, but not your teacher or grade.', 1],
      ['Say the general town or area instead.', 2],
      ['Keep the school private and keep chatting about the game.', 5],
      ['Ask their school first, then decide if it feels fair to answer.', 1]
    ]
  },
  {
    id: 'photo-background', minAge: 6, category: 'Privacy', tag: 'Photo',
    q: 'You want to post a photo you really like. In the background, a package label and part of your street can be seen.',
    detail: 'The picture itself does not feel private.',
    answers: [
      ['Post it because people probably will not zoom in.', 1],
      ['Crop or cover the background details before posting.', 5],
      ['Only post it to followers you already have.', 3],
      ['Wait until later and decide again if the photo is worth sharing.', 4]
    ]
  },
  {
    id: 'account-warning', minAge: 6, category: 'Scams', tag: 'Account alert',
    q: 'A message says your account will be locked in 10 minutes unless you sign in using its link.',
    detail: 'The message uses the app logo and your username.',
    answers: [
      ['Use the link, but stop if the page looks strange.', 1],
      ['Open the real app or website yourself and check the account there.', 5],
      ['Reply and ask the sender to prove they work for the app.', 2],
      ['Ignore it for now and see whether the account actually gets locked.', 4]
    ]
  },
  {
    id: 'gift-card', minAge: 6, category: 'Scams', tag: 'Prize',
    q: 'A creator you follow seems to message you saying you won a prize, but you need to pay a small shipping fee first.',
    detail: 'The profile photo and name look right at first glance.',
    answers: [
      ['Pay if the fee is small enough to risk.', 1],
      ['Check the creator’s real profile and public posts for the giveaway details before doing anything.', 5],
      ['Ask for a different payment method so your card is safer.', 2],
      ['Send a screenshot to a friend and go with what they think.', 3]
    ]
  },
  {
    id: 'voice-chat', minAge: 6, category: 'People', tag: 'Voice chat',
    q: 'A person you have played with for weeks wants to move from game chat to a private voice call.',
    detail: 'Nothing bad has happened so far.',
    answers: [
      ['Join because several weeks is long enough to know someone.', 2],
      ['Stay in the game’s normal chat unless a trusted adult knows and the privacy settings are right.', 5],
      ['Join, but do not turn on video.', 3],
      ['Ask another online friend to join the call too.', 3]
    ]
  },
  {
    id: 'mean-group', minAge: 6, category: 'Behavior', tag: 'Group chat',
    q: 'A group chat starts making jokes about one kid and everyone is adding reactions.',
    detail: 'You are not the person being targeted.',
    answers: [
      ['Do not join in, but stay in the chat and watch.', 3],
      ['Add one mild reaction so nobody thinks you are taking sides.', 1],
      ['Do not pile on, save evidence if needed, and tell someone if it becomes harassment or threats.', 5],
      ['Leave immediately and never look at the chat again.', 4]
    ]
  },
  {
    id: 'location-streak', minAge: 6, category: 'Privacy', tag: 'Location',
    q: 'Your friends use a map feature that shows where everyone is. Turning yours off might look unfriendly.',
    detail: 'You like knowing where your friends are too.',
    answers: [
      ['Leave it on for friends because that is what the feature is for.', 2],
      ['Use the most private location setting and only share when there is a real reason.', 5],
      ['Keep it on during the day but turn it off at night.', 3],
      ['Share only when you are away from home.', 3]
    ]
  },
  {
    id: 'password-friend', minAge: 6, category: 'Accounts', tag: 'Password',
    q: 'Your best friend asks for your password so they can keep a streak going while you are away.',
    detail: 'You trust them in real life.',
    answers: [
      ['Share it, then change it when you get back.', 2],
      ['Do not share it; use an official account feature if one exists.', 5],
      ['Share it only if you use a temporary easy password.', 1],
      ['Let them log in while you watch first, then decide.', 2]
    ]
  },
  {
    id: 'download-mod', minAge: 6, category: 'Downloads', tag: 'Download',
    q: 'A video shows a free mod for a game you like. Thousands of comments say it works.',
    detail: 'The download is on a site you have never used before.',
    answers: [
      ['Download it if your antivirus does not complain.', 2],
      ['Search for the mod from the game’s official community or other trusted sources first.', 5],
      ['Read the newest comments and install it if nobody reports a problem.', 3],
      ['Download the file but do not open it until you know more.', 3]
    ]
  },
  {
    id: 'secret-chat', minAge: 6, category: 'People', tag: 'Secret',
    q: 'An online friend tells you not to mention your conversations to your family because “they would not understand.”',
    detail: 'They have also been very supportive and kind to you.',
    answers: [
      ['Keep it private because everyone deserves some privacy.', 2],
      ['Treat the secrecy request as a warning sign and tell a trusted adult what is happening.', 5],
      ['Keep chatting but avoid sharing anything personal.', 3],
      ['Ask why it needs to be secret before deciding.', 3]
    ]
  },
  {
    id: 'screen-share', minAge: 6, category: 'Privacy', tag: 'Screen share',
    q: 'A friend wants to help you fix something on your computer and asks you to share your whole screen.',
    detail: 'You know them from school, but private messages and notifications may pop up.',
    answers: [
      ['Share the whole screen because you know them offline.', 2],
      ['Share only the needed app/window and close private things first.', 5],
      ['Turn notifications off and then share everything.', 4],
      ['Take photos of the problem and send those instead.', 4]
    ]
  },
  {
    id: 'viral-claim', minAge: 6, category: 'Information', tag: 'Viral post',
    q: 'A dramatic post says something important happened at your school. Lots of people are reposting it.',
    detail: 'You cannot tell where the original claim came from.',
    answers: [
      ['Repost it with “not sure if true” so people are warned.', 2],
      ['Wait for a reliable source or direct confirmation before spreading it.', 5],
      ['Ask in a big group chat whether anybody knows the truth.', 3],
      ['Believe it if several people you know already shared it.', 1]
    ]
  },
  {
    id: 'camera-request', minAge: 6, category: 'People', tag: 'Camera', sexBias: 'any',
    q: 'Someone you only know online asks you to turn on your camera so they can “prove you are a real person.”',
    detail: 'They say they will turn theirs on too.',
    answers: [
      ['Do it briefly, but keep the background hidden.', 2],
      ['Decline; you do not owe an online stranger visual proof of who you are.', 5],
      ['Ask them to go first and decide after you see them.', 1],
      ['Use a funny filter so your real face is less clear.', 2]
    ]
  },
  {
    id: 'emotional-pressure', minAge: 11, category: 'People', tag: 'Pressure',
    q: 'An online friend gets upset when you do not answer quickly and says a real friend would always be available.',
    detail: 'You care about them and do not want to make things worse.',
    answers: [
      ['Answer faster so they do not feel ignored.', 2],
      ['Set a boundary about when you can reply and get help from a trusted adult if the pressure continues.', 5],
      ['Mute them for a week without saying anything.', 3],
      ['Explain everything you are doing each day so they know when you are busy.', 2]
    ]
  },
  {
    id: 'meetup', minAge: 11, category: 'People', tag: 'Meetup',
    q: 'A person you have known online for months says they will be near your town and suggests meeting in a busy public place.',
    detail: 'They have video-called before and seem to be the age they said.',
    answers: [
      ['Meet because a public place makes it safe enough.', 2],
      ['Only consider it with a parent/guardian fully involved and present, following family rules.', 5],
      ['Bring two friends instead of an adult.', 2],
      ['Go only during the daytime and share your location with family.', 3]
    ]
  },
  {
    id: 'two-factor', minAge: 6, category: 'Accounts', tag: 'Login code',
    q: 'A friend says a login code was accidentally sent to your phone and asks you to read it to them.',
    detail: 'They know your name and some details about you.',
    answers: [
      ['Send it if they can explain what account it is for.', 1],
      ['Do not send the code; check your own accounts because the code may be protecting them.', 5],
      ['Send a screenshot with the numbers covered so they know a code arrived.', 4],
      ['Wait ten minutes and send it only if nothing else happens.', 1]
    ]
  },
  {
    id: 'personal-question', minAge: 6, category: 'Privacy', tag: 'Personal info',
    q: 'A harmless-looking quiz asks for your first pet’s name, birthday month, and the street you grew up on.',
    detail: 'It promises to tell you your “perfect character name.”',
    answers: [
      ['Use fake answers that are not connected to your real life.', 5],
      ['Answer because none of those details is a password.', 1],
      ['Answer only the ones that do not feel embarrassing.', 2],
      ['Use shortened versions of the real answers.', 2]
    ]
  },
  {
    id: 'angry-post', minAge: 6, category: 'Behavior', tag: 'Posting',
    q: 'You are angry at someone and have a post ready that explains exactly what they did.',
    detail: 'Everything you wrote is true from your point of view.',
    answers: [
      ['Post it, but leave their name out.', 2],
      ['Save it as a draft and revisit it after you have cooled down.', 5],
      ['Post it only to close friends.', 3],
      ['Ask one friend to read it and post if they agree.', 3]
    ]
  },
  {
    id: 'girls-only-group', minAge: 9, category: 'People', tag: 'Private group', sexBias: 'female',
    q: 'An account you do not know invites you to a “girls your age only” private group and asks for a selfie to verify you belong.',
    detail: 'The page has lots of followers and some people in the comments say they joined.',
    answers: [
      ['Send a normal selfie with no location details in it.', 2],
      ['Do not send proof of your identity to an unknown account; check with a trusted adult or stick to groups you can verify.', 5],
      ['Ask someone already in the group whether it is safe first.', 3],
      ['Join with a blank profile and decide about the selfie later.', 3]
    ]
  },
  {
    id: 'boys-only-group', minAge: 9, category: 'People', tag: 'Private group', sexBias: 'male',
    q: 'An account you do not know invites you to a “boys your age only” private group and asks for a selfie to verify you belong.',
    detail: 'The page has lots of followers and some people in the comments say they joined.',
    answers: [
      ['Send a normal selfie with no location details in it.', 2],
      ['Do not send proof of your identity to an unknown account; check with a trusted adult or stick to groups you can verify.', 5],
      ['Ask someone already in the group whether it is safe first.', 3],
      ['Join with a blank profile and decide about the selfie later.', 3]
    ]
  },
  {
    id: 'unknown-airdrop', minAge: 6, category: 'Downloads', tag: 'Nearby share',
    q: 'Your phone shows a nearby file-sharing request with a funny filename while you are in a crowded place.',
    detail: 'You do not know who sent it.',
    answers: [
      ['Accept it because you can delete it if it is weird.', 1],
      ['Decline it and keep nearby sharing limited to people you know.', 5],
      ['Accept only if the file is an image.', 2],
      ['Wait to see whether someone nearby says it is theirs.', 3]
    ]
  },
  {
    id: 'support-scam', minAge: 6, category: 'Scams', tag: 'Tech support',
    q: 'A pop-up says your device is infected and gives a phone number or chat button for immediate help.',
    detail: 'It makes a loud sound and is hard to close.',
    answers: [
      ['Contact the number but do not give payment information.', 1],
      ['Close the browser/app and use trusted device or family support to check for a real problem.', 5],
      ['Restart the device and contact them only if the message comes back.', 3],
      ['Search the phone number to see if other people trust it.', 4]
    ]
  },
  {
    id: 'game-trade', minAge: 6, category: 'Scams', tag: 'Trade',
    q: 'A player offers an unusually good in-game trade but says the normal trading system is too slow.',
    detail: 'They want to use a different website to finish the trade.',
    answers: [
      ['Use the website if it looks like the game’s colors and logo.', 1],
      ['Keep the trade inside the game’s official system, even if the deal disappears.', 5],
      ['Ask them to send their item first.', 3],
      ['Search the website name before deciding.', 4]
    ]
  },
  {
    id: 'public-wifi', minAge: 12, category: 'Accounts', tag: 'Public Wi‑Fi',
    q: 'You are on free public Wi‑Fi and need to sign in to an important account.',
    detail: 'The connection works, but you do not know who runs the network.',
    answers: [
      ['Sign in normally because modern sites are usually secure.', 3],
      ['Use your own cellular connection or wait for a network you trust when possible.', 5],
      ['Use the Wi‑Fi but change your password afterward.', 2],
      ['Only sign in if the site has a lock icon.', 3]
    ]
  },
  {
    id: 'family-info', minAge: 6, category: 'Privacy', tag: 'Family info',
    q: 'Someone in a game asks what your parent or guardian does for work because they say it sounds interesting.',
    detail: 'They are not asking for a phone number or address.',
    answers: [
      ['Answer generally, like “they work in an office.”', 4],
      ['Give the job title but not the company name.', 3],
      ['Tell them the company if it is a big company everyone knows.', 1],
      ['Change the subject and keep family details private.', 5]
    ]
  },
  {
    id: 'blocked-return', minAge: 6, category: 'People', tag: 'Blocking',
    q: 'You block someone who made you uncomfortable. The next day, a new account messages you and seems to be the same person.',
    detail: 'The new message is polite and says they only want to explain.',
    answers: [
      ['Read the explanation before deciding whether to block again.', 2],
      ['Block/report the new account and tell a trusted adult if the person keeps returning.', 5],
      ['Reply once to say clearly that you do not want contact.', 3],
      ['Ignore the message but leave the account unblocked in case they stop.', 3]
    ]
  },
  {
    id: 'ai-chat', minAge: 9, category: 'Information', tag: 'AI chat',
    q: 'An AI chatbot gives you confident advice about a serious personal problem.',
    detail: 'The answer sounds calm and very specific.',
    answers: [
      ['Follow it if the explanation makes sense.', 2],
      ['Use it as one source, but involve a trusted adult or qualified person for serious decisions.', 5],
      ['Ask the chatbot the same question in a different way and compare answers.', 3],
      ['Search for another chatbot and see whether it agrees.', 3]
    ]
  },
  {
    id: 'stream-background', minAge: 6, category: 'Privacy', tag: 'Streaming',
    q: 'You want to livestream from your room, and the camera view includes photos, trophies, and a window.',
    detail: 'None of the items seems secret by itself.',
    answers: [
      ['Stream if your account is private.', 3],
      ['Check the whole frame for identifying details and use a safer background before going live.', 5],
      ['Close the curtains and leave everything else as it is.', 3],
      ['Use a lower video quality so details are harder to read.', 2]
    ]
  },
  {
    id: 'discord-server', minAge: 13, category: 'People', tag: 'Discord invite',
    q: 'A gaming friend invites you to a private Discord server with people you do not know.',
    detail: 'They say it is more fun because there are fewer rules.',
    answers: [
      ['Join and leave if people get weird.', 3],
      ['Check who runs it, lock down privacy, and avoid it if the setup feels unsafe.', 5],
      ['Join only if my friend stays there too.', 3],
      ['Make a second account just for the server.', 2]
    ]
  },
  {
    id: 'private-photo', minAge: 13, category: 'People', tag: 'Photo pressure',
    q: 'Someone you like keeps asking for a private photo you would not normally post.',
    detail: 'They promise they will never save or share it.',
    answers: [
      ['Send one if their promise feels real.', 1],
      ['Say no and do not send something I cannot take back.', 5],
      ['Send one that does not show my face.', 2],
      ['Ask them to send something private first.', 1]
    ]
  }
];


// Kid-first copy. These replacements keep the original hidden scoring and age gates,
// but use shorter, more familiar language and recognizable game/app situations.
const kidCopy = {
  'new-friend': ['A Roblox friend you have played with a lot asks what school you go to.', 'They say they might live close to you.', [['Tell them the school, but not my teacher.',1],['Tell them only the town I live near.',2],['Skip that question and keep talking about Roblox.',5],['Ask what school they go to first.',2]]],
  'photo-background': ['You take a cool photo to post, but your street sign is in the background.', 'It is small, but someone could zoom in.', [['Post it because the sign is hard to see.',2],['Crop or cover the sign first.',5],['Post it only for friends or followers.',3],['Wait until tomorrow and decide then.',4]]],
  'account-warning': ['A message says your account will be locked soon unless you tap a link.', 'It has the app logo and your username.', [['Tap it, but leave if the page looks weird.',2],['Open the real app myself and check there.',5],['Reply and ask if the message is real.',3],['Ignore it for now and see what happens.',4]]],
  'gift-card': ['A YouTuber you follow seems to message you saying you won a prize.', 'They want a small payment for shipping.', [['Pay if the amount is small.',1],['Check the creator’s real page for the giveaway first.',5],['Ask if I can pay a different way.',2],['Send it to a friend and see what they think.',4]]],
  'voice-chat': ['A player you know from a game asks you to join a private voice chat.', 'You have played together for a few weeks.', [['Join because we have played together a lot.',2],['Stay in normal game chat unless a trusted adult knows.',5],['Join, but keep my camera off.',3],['Ask another online friend to join too.',3]]],
  'mean-group': ['A group chat starts making fun of one kid, and everyone is reacting to it.', 'Nobody is making fun of you.', [['Stay quiet and just watch.',3],['Add one small reaction so I fit in.',1],['Do not join in, and get help if it turns into bullying or threats.',5],['Leave the chat right away and forget about it.',4]]],
  'location-streak': ['Your friends use an app map that shows where everyone is.', 'Most of your friends leave their location on all day.', [['Leave mine on because my friends do.',2],['Keep it private and share only when I need to.',5],['Turn it off only when I am at home.',3],['Leave it on during the day, but not at night.',3]]],
  'password-friend': ['Your best friend asks for your game password so they can help with your account.', 'You know them in real life and trust them.', [['Give it to them, then change it later.',2],['Do not share it. Find another way they can help.',5],['Make a simple password just for today.',1],['Let them log in while I watch.',3]]],
  'download-mod': ['A YouTube video shows a free game mod and links to a website you have never used.', 'Lots of comments say it works.', [['Download it if my antivirus says nothing.',2],['Look for the mod on an official or trusted game site first.',5],['Read the newest comments, then decide.',4],['Download it now, but do not open it yet.',3]]],
  'secret-chat': ['An online friend says, “Do not tell your family we talk. They would not get it.”', 'They have always been nice to you.', [['Keep it secret because they have been nice.',2],['Tell a trusted adult about the secret request.',5],['Keep chatting, but share less about myself.',3],['Ask why it has to be secret first.',4]]],
  'screen-share': ['A friend wants to help fix a game and asks you to share your whole screen.', 'Private messages or notifications might pop up.', [['Share everything because I know them.',2],['Share only the game window and close private stuff first.',5],['Turn off notifications, then share everything.',4],['Send a picture of the problem instead.',4]]],
  'viral-claim': ['A post says something big happened at school, and lots of kids are sharing it.', 'You cannot tell who first posted it.', [['Share it and say “I do not know if this is true.”',2],['Wait until the school or another trusted source confirms it.',5],['Ask a big group chat if anyone knows.',4],['Believe it if several friends already shared it.',1]]],
  'camera-request': ['Someone you only know online asks you to turn on your camera to prove you are real.', 'They say they will turn theirs on too.', [['Turn it on for a few seconds.',2],['Say no. I do not have to prove myself on camera.',5],['Make them turn theirs on first.',1],['Use a funny filter so my face looks different.',3]]],
  'emotional-pressure': ['An online friend gets upset if you do not reply fast and says, “Real friends always answer.”', 'You care about them and do not want to be mean.', [['Try to answer faster so they feel better.',2],['Tell them I cannot always reply right away and get help if the pressure keeps going.',5],['Mute them for a week without saying anything.',3],['Tell them my whole schedule so they know when I am busy.',2]]],
  'meetup': ['Someone you have known online for months says they will be nearby and wants to meet.', 'They suggest a busy public place and you have video-called before.', [['Meet because the place is public.',2],['Only consider it with a parent or guardian fully involved and there with me.',5],['Bring two friends instead of an adult.',2],['Go in daytime and share my location with family.',3]]],
  'two-factor': ['Someone says a login code was sent to your phone by mistake and asks you to send it.', 'They know your name, so the message seems real.', [['Send it if they tell me what account it is for.',1],['Keep the code private and check my own account.',5],['Send a screenshot with some numbers covered.',4],['Wait a few minutes, then send it if nothing happens.',1]]],
  'personal-question': ['A fun online quiz asks for your pet name, birthday month, and old street name.', 'It says it will make your perfect gamer name.', [['Use made-up answers that are not about my real life.',5],['Answer because none of those is my password.',1],['Answer only the easy questions.',2],['Use shorter versions of the real answers.',2]]],
  'angry-post': ['You are mad at someone and have a post ready explaining what they did.', 'What you wrote feels true to you.', [['Post it, but leave their name out.',2],['Save it and look at it again after I cool down.',5],['Post it only to close friends.',3],['Ask one friend if I should post it.',4]]],
  'girls-only-group': ['An account invites you to a “girls your age” group, but asks for a selfie first.', 'The page has lots of followers and looks normal.', [['Send a simple selfie with nothing private behind me.',2],['Do not send proof of who I am to a group I cannot verify.',5],['Ask someone in the group if it is safe.',4],['Join with a blank profile and decide later.',3]]],
  'boys-only-group': ['An account invites you to a “boys your age” group, but asks for a selfie first.', 'The page has lots of followers and looks normal.', [['Send a simple selfie with nothing private behind me.',2],['Do not send proof of who I am to a group I cannot verify.',5],['Ask someone in the group if it is safe.',4],['Join with a blank profile and decide later.',3]]],
  'unknown-airdrop': ['Your phone gets a nearby file request from someone you do not know.', 'The file name sounds funny, and you are in a crowded place.', [['Accept it because I can delete it later.',1],['Decline it and keep sharing set to people I know.',5],['Accept it only if it says it is a picture.',2],['Wait to see if someone nearby says it is theirs.',4]]],
  'support-scam': ['A pop-up says your device has a virus and tells you to call or chat for help.', 'It makes a loud sound and is hard to close.', [['Contact them, but do not pay anything.',1],['Close it and use trusted device or family help to check.',5],['Restart first and contact them only if it comes back.',3],['Search the phone number before I decide.',4]]],
  'game-trade': ['A Roblox player offers an amazing trade, but wants to finish it on another website.', 'They say the normal trade screen takes too long.', [['Use the site if it looks like Roblox.',1],['Keep the trade inside the game, even if I lose the deal.',5],['Ask them to give me their item first.',3],['Search the website name before deciding.',4]]],
  'public-wifi': ['You are on free public Wi-Fi and need to sign in to an important account.', 'The Wi-Fi works, but you do not know who runs it.', [['Sign in normally because the website has a lock icon.',3],['Use my phone data or wait for a network I trust if I can.',5],['Use the Wi-Fi, then change my password later.',2],['Sign in only if I have used that website before.',3]]],
  'family-info': ['Someone in a game asks what your parent or guardian does for work.', 'They are just making conversation.', [['Say something general, like “they work in an office.”',4],['Give the job name, but not the company.',3],['Tell them the company if it is a big one.',1],['Change the subject and keep family details private.',5]]],
  'blocked-return': ['You block someone who made you uncomfortable. A new account messages you the next day.', 'It seems like the same person, but the message is polite.', [['Read what they say before deciding.',2],['Block or report again, and tell an adult if they keep coming back.',5],['Reply once and tell them to stop.',3],['Ignore the message but leave the account unblocked.',3]]],
  'ai-chat': ['An AI chatbot gives you very confident advice about a serious problem.', 'The answer sounds smart and specific.', [['Follow it if the answer makes sense.',2],['Use it for ideas, but ask a trusted real person too.',5],['Ask the AI the same thing again in a different way.',3],['Ask another AI and see if it agrees.',3]]],
  'stream-background': ['You want to livestream, but your room has school stuff and family photos behind you.', 'Nothing looks secret at first.', [['Go live if my account is private.',3],['Move or blur things that could show who or where I am.',5],['Close the curtains and leave the rest.',4],['Use lower video quality so details are harder to see.',2]]]
};

function useKidCopy(item) {
  const copy = kidCopy[item.id];
  if (!copy) return item;
  return { ...item, q: copy[0], detail: copy[1], answers: copy[2] };
}

const screens = {
  intro: document.getElementById('introScreen'),
  quiz: document.getElementById('quizScreen'),
  result: document.getElementById('resultScreen')
};

const profileForm = document.getElementById('profileForm');
const questionCard = document.getElementById('questionCard');
const questionText = document.getElementById('questionText');
const questionDetail = document.getElementById('questionDetail');
const scenarioTag = document.getElementById('scenarioTag');
const answersWrap = document.getElementById('answers');
const progressLabel = document.getElementById('progressLabel');
const progressPercent = document.getElementById('progressPercent');
const progressFill = document.getElementById('progressFill');
const restartTop = document.getElementById('restartTop');
const tryAgain = document.getElementById('tryAgain');
const showReview = document.getElementById('showReview');
const readQuestionButton = document.getElementById('readQuestion');
const autoReadToggle = document.getElementById('autoRead');
const voiceSelect = document.getElementById('voiceSelect');
const readerStatus = document.getElementById('readerStatus');

let state = {
  age: null,
  sex: 'unspecified',
  questions: [],
  index: 0,
  responses: [],
  renderedAnswers: []
};

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildQuiz(age, sex) {
  const eligible = questionBank.filter(item => age >= item.minAge).map(useKidCopy);
  const preferred = eligible.filter(item => item.sexBias === sex);
  const general = eligible.filter(item => !item.sexBias || item.sexBias === 'any');
  const alternate = eligible.filter(item => item.sexBias && item.sexBias !== sex && item.sexBias !== 'any');

  // Give older kids a few scenarios that match the online spaces they are more likely to use.
  // The rest stays mixed so the quiz still covers basic privacy, scams, accounts and behavior.
  const picked = [];
  const ageFloor = age >= 13 ? 11 : age >= 9 ? 9 : 6;
  const agePriority = shuffle(general.filter(item => item.minAge >= ageFloor));
  const priorityCount = age >= 9 ? Math.min(4, agePriority.length) : 0;
  picked.push(...agePriority.slice(0, priorityCount));

  // Keep sex-specific branching subtle and non-stereotyped: at most one tailored scenario.
  if (sex !== 'unspecified' && preferred.length && picked.length < TOTAL_QUESTIONS) picked.push(shuffle(preferred)[0]);

  const pool = shuffle(general);
  for (const q of pool) {
    if (picked.length >= TOTAL_QUESTIONS) break;
    if (!picked.some(p => p.id === q.id)) picked.push(q);
  }

  // Younger age filters can leave fewer than 20 general scenarios; fill carefully.
  for (const q of shuffle([...preferred, ...alternate])) {
    if (picked.length >= TOTAL_QUESTIONS) break;
    if (!picked.some(p => p.id === q.id)) picked.push(q);
  }

  return shuffle(picked.slice(0, TOTAL_QUESTIONS));
}

function showScreen(name) {
  Object.values(screens).forEach(screen => screen.classList.remove('screen-active'));
  screens[name].classList.add('screen-active');
  restartTop.hidden = name === 'intro';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateProgress() {
  const number = state.index + 1;
  const pct = Math.round((number / TOTAL_QUESTIONS) * 100);
  progressLabel.textContent = `Question ${number} of ${TOTAL_QUESTIONS}`;
  progressPercent.textContent = `${pct}%`;
  progressFill.style.width = `${pct}%`;
}

function renderQuestion(animate = true) {
  const item = state.questions[state.index];
  updateProgress();
  scenarioTag.textContent = item.tag;
  questionText.textContent = item.q;
  questionDetail.textContent = item.detail;
  answersWrap.replaceChildren();

  const letters = ['A', 'B', 'C', 'D'];
  const shuffledAnswers = shuffle(item.answers.map(([text, score]) => ({ text, score })));
  state.renderedAnswers = shuffledAnswers;
  shuffledAnswers.forEach((answer, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'answer-button';
    button.innerHTML = `<span class="answer-letter">${letters[i]}</span><span>${escapeHtml(answer.text)}</span>`;
    button.addEventListener('click', () => chooseAnswer(item, answer));
    button.setAttribute('aria-label', `Choice ${letters[i]}: ${answer.text}`);
    answersWrap.appendChild(button);
  });

  if (animate) {
    questionCard.classList.remove('is-leaving');
    questionCard.classList.add('is-entering');
    window.setTimeout(() => questionCard.classList.remove('is-entering'), 350);
    window.setTimeout(() => questionText.focus({ preventScroll: true }), 230);
  }

  if (autoReadToggle?.checked) window.setTimeout(speakCurrentQuestion, animate ? 380 : 120);
}

function escapeHtml(text) {
  return text.replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

function chooseAnswer(question, answer) {
  stopSpeaking();
  answersWrap.querySelectorAll('button').forEach(btn => btn.disabled = true);
  state.responses.push({ id: question.id, category: question.category, score: answer.score, max: 5 });

  if (state.index >= TOTAL_QUESTIONS - 1) {
    window.setTimeout(showResults, 180);
    return;
  }

  questionCard.classList.add('is-leaving');
  window.setTimeout(() => {
    state.index += 1;
    renderQuestion(true);
  }, 220);
}

function calculateResults() {
  const raw = state.responses.reduce((sum, item) => sum + item.score, 0);
  const min = TOTAL_QUESTIONS;
  const max = TOTAL_QUESTIONS * 5;
  const normalized = Math.round(1 + ((raw - min) / (max - min)) * 99);
  const score = Math.max(1, Math.min(100, normalized));

  const byCategory = {};
  state.responses.forEach(item => {
    byCategory[item.category] ??= { total: 0, count: 0 };
    byCategory[item.category].total += item.score;
    byCategory[item.category].count += 1;
  });

  const categoryScores = Object.entries(byCategory).map(([category, data]) => ({
    category,
    score: Math.round((data.total / (data.count * 5)) * 100)
  })).sort((a, b) => a.score - b.score);

  return { score, categoryScores };
}

function getBand(score, age) {
  const youngerNote = age <= 9 ? ' At your age, adult supervision is still important even with strong instincts.' : '';
  if (score >= 88) return {
    cls: 'status-mint',
    label: 'Strong safety instincts',
    summary: `You noticed a lot of the small warning signs that are easy to miss.${youngerNote}`,
    readiness: age <= 9 ? 'Good instincts — keep browsing with an adult nearby.' : 'Shows strong judgment for age-appropriate independent use.'
  };
  if (score >= 72) return {
    cls: 'status-purple',
    label: 'Mostly safety-aware',
    summary: `You make many careful choices, but a few believable situations could still catch you off guard.${youngerNote}`,
    readiness: 'Reasonable online judgment with normal family rules and check-ins.'
  };
  if (score >= 52) return {
    cls: 'status-amber',
    label: 'Needs more practice',
    summary: 'Some of your choices could expose personal information, accounts, or put you in situations that are harder to control.',
    readiness: 'Best online with active adult guidance while practicing the weak spots.'
  };
  return {
    cls: 'status-red',
    label: 'Use close supervision',
    summary: 'Several common online tricks and pressure situations were hard to spot in this round.',
    readiness: 'Not ready for unsupervised online use yet — practice with a trusted adult first.'
  };
}

function showResults() {
  const { score, categoryScores } = calculateResults();
  const band = getBand(score, state.age);
  showScreen('result');

  document.getElementById('scoreNumber').textContent = score;
  document.getElementById('resultSummary').textContent = band.summary;
  const status = document.getElementById('resultStatus');
  status.className = `result-status ${band.cls}`;
  status.innerHTML = `<strong>${band.label}</strong> — ${band.readiness}`;

  const gaugeLength = 282.74;
  const offset = gaugeLength * (1 - score / 100);
  const gaugeValue = document.getElementById('gaugeValue');
  gaugeValue.style.strokeDashoffset = gaugeLength;
  document.getElementById('needle').style.transform = 'rotate(-90deg)';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      gaugeValue.style.strokeDashoffset = offset;
      document.getElementById('needle').style.transform = `rotate(${-90 + (score / 100) * 180}deg)`;
    });
  });

  const sortedHigh = [...categoryScores].sort((a,b) => b.score - a.score);
  const strongest = sortedHigh[0] || { category: 'Safety', score };
  const second = sortedHigh[1] || strongest;
  const practice = categoryScores[0] || strongest;

  document.getElementById('insightGrid').innerHTML = `
    <div class="insight"><strong>${strongest.score}%</strong><span>Strongest: ${escapeHtml(strongest.category)}</span></div>
    <div class="insight"><strong>${second.score}%</strong><span>Also strong: ${escapeHtml(second.category)}</span></div>
    <div class="insight"><strong>${practice.score}%</strong><span>Practice: ${escapeHtml(practice.category)}</span></div>
  `;

  const reviews = categoryScores.slice(0, 3);
  document.getElementById('reviewList').innerHTML = reviews.map(item => {
    const tip = categoryTip(item.category);
    return `<div class="review-item"><strong>${escapeHtml(item.category)} — ${item.score}%</strong><p>${escapeHtml(tip)}</p></div>`;
  }).join('');
  document.getElementById('reviewPanel').hidden = true;
  showReview.textContent = 'See what to practice';
}

function categoryTip(category) {
  const tips = {
    People: 'Be careful when someone pushes for secrecy, private contact, proof, a meetup, or faster replies. Kind people can still ask unsafe things.',
    Privacy: 'Before sharing, look beyond the main thing you are posting. Backgrounds, locations, family details, and “small” facts can connect together.',
    Scams: 'Urgency, unusually good deals, prizes, and moving outside an official system are common pressure tactics. Verify through the real app or site.',
    Accounts: 'Passwords and login codes should stay private. Use official account tools and safer networks whenever possible.',
    Downloads: 'Popularity and comments do not prove a file is safe. Prefer official or trusted sources and avoid unknown transfers.',
    Behavior: 'Slow down when emotions are high. Avoid piling on, save evidence when needed, and involve a trusted adult when behavior becomes harassment or threats.',
    Information: 'Confidence is not proof. Check important claims with reliable sources and involve a real trusted person for serious decisions.'
  };
  return tips[category] || 'Pause, check the situation, and involve a trusted adult when something feels hard to verify or control.';
}

function resetQuiz() {
  state = { age: null, sex: 'unspecified', questions: [], index: 0, responses: [], renderedAnswers: [] };
  profileForm.reset();
  const unspecified = profileForm.querySelector('input[name="sex"][value="unspecified"]');
  if (unspecified) unspecified.checked = true;
  showScreen('intro');
}

profileForm.addEventListener('submit', event => {
  event.preventDefault();
  const formData = new FormData(profileForm);
  const age = Number(formData.get('age'));
  const sex = formData.get('sex') || 'unspecified';
  state.age = age;
  state.sex = sex;
  state.questions = buildQuiz(age, sex);
  state.index = 0;
  state.responses = [];
  state.renderedAnswers = [];
  showScreen('quiz');
  renderQuestion(false);
});

restartTop.addEventListener('click', resetQuiz);
tryAgain.addEventListener('click', resetQuiz);
showReview.addEventListener('click', () => {
  const panel = document.getElementById('reviewPanel');
  panel.hidden = !panel.hidden;
  showReview.textContent = panel.hidden ? 'See what to practice' : 'Hide practice tips';
});


// Built-in Read Aloud. This complements full screen readers such as Narrator,
// VoiceOver, NVDA and TalkBack; it does not replace them.
const speechSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
let availableVoices = [];

function stopSpeaking() {
  if (!speechSupported) return;
  window.speechSynthesis.cancel();
  readQuestionButton?.classList.remove('is-speaking');
  if (readerStatus) readerStatus.textContent = 'Ready to read aloud';
}

function voiceScore(voice) {
  const name = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  let score = voice.lang?.toLowerCase().startsWith('en-us') ? 20 : 10;
  if (/natural|online/.test(name)) score += 50;
  if (/aria|jenny|ava|guy|samantha|google us english|microsoft/.test(name)) score += 25;
  if (/compact|espeak|festival/.test(name)) score -= 30;
  return score;
}

function loadVoices() {
  if (!speechSupported || !voiceSelect) return;
  availableVoices = window.speechSynthesis.getVoices().filter(v => v.lang?.toLowerCase().startsWith('en')).sort((a,b) => voiceScore(b)-voiceScore(a));
  voiceSelect.replaceChildren();
  if (!availableVoices.length) {
    voiceSelect.append(new Option('Best voice on this device', ''));
    return;
  }
  availableVoices.slice(0,12).forEach((voice, index) => voiceSelect.append(new Option(index === 0 ? `Best voice — ${voice.name}` : voice.name, voice.voiceURI)));
}

function speakCurrentQuestion() {
  if (!speechSupported || !state.questions[state.index]) return;
  stopSpeaking();
  const item = state.questions[state.index];
  const letters = ['A','B','C','D'];
  const choices = state.renderedAnswers.map((answer,i) => `Choice ${letters[i]}. ${answer.text}`).join('. ');
  const utterance = new SpeechSynthesisUtterance(`${item.q} ${item.detail} ${choices}`);
  const voice = availableVoices.find(v => v.voiceURI === voiceSelect?.value) || availableVoices[0];
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || 'en-US';
  utterance.rate = state.age <= 9 ? 0.90 : 0.96;
  utterance.pitch = 1.02;
  utterance.onstart = () => { readQuestionButton?.classList.add('is-speaking'); if (readerStatus) readerStatus.textContent = 'Reading question and choices'; };
  utterance.onend = () => { readQuestionButton?.classList.remove('is-speaking'); if (readerStatus) readerStatus.textContent = 'Ready to read aloud'; };
  utterance.onerror = e => { readQuestionButton?.classList.remove('is-speaking'); if (readerStatus) readerStatus.textContent = ['interrupted','canceled'].includes(e.error) ? 'Ready to read aloud' : 'Could not play this voice'; };
  window.speechSynthesis.speak(utterance);
}

function setupReader() {
  if (!speechSupported) { document.getElementById('readerTools')?.setAttribute('hidden',''); return; }
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
  readQuestionButton?.addEventListener('click', () => window.speechSynthesis.speaking ? stopSpeaking() : speakCurrentQuestion());
}

setupReader();
