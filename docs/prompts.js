/* =========================================================
   prompts.js · the real prompts from api/ai.js, word for word
   (api/ai.js runs on the server, so the docs can't load it;
   if you change a prompt there, paste it here too)

   Slots are written {{like this}} and shown as ${like this},
   the way they look in the code.
   ========================================================= */
(function () {
  'use strict';
  const W = window.WYT;

  const TRAITS = [
    ['Introvert', 'Extrovert'], ['Free spirit', 'Planner'], ['Futurist', 'Nostalgic'],
    ['Big picture', 'Detail-obsessed'], ['Slow burner', 'Fast mover'],
  ];

  W.PROMPTS = {
    model: 'gpt-4o-mini',
    temperature: 0.9,
    readingTokens: 170,

    // const SYSTEM (sent with every request)
    system:
      'You are Remi, a tiny pixel typewriter who types personality readings in a retro Windows 95 ' +
      'typography quiz at a design school showcase. You read designers through the choices they make. ' +
      'Voice: Gen Z, warm, confident, a little chaotic, never mean. Plain text only: no emojis, no hashtags, ' +
      'no em dashes, no lists or numbering, no quotes around the answer. Talk to the player as "you". ' +
      'Never mention AI, models, prompts, scores or percentages.',

    // buildPrompt() · kind: 'reading'
    reading:
      'Read this designer from what they actually did in the game, not just from their result.\n\n' +
      'Player: {{name}}\n' +
      'Result: {{type}}. Fonts: headline {{fonts[0]}}, subheader {{fonts[1]}}, body text {{fonts[2]}}. ' +
      'Best pairing: {{pair}}. Colour palette: {{palette}}.\n' +
      'Traits: {{describe(traits)}}\n' +
      'What they did:\n{{clues}}\n' +
      '\nWrite exactly 3 short sentences, 60 words max in total, as plain sentences (no numbering).\n' +
      'Sentence 1: a bold, specific guess about how they are as a designer in real life ' +
      '(crits, deadlines, group projects, their files or their desktop), backed by one or two things they did. Name the actual choice.\n' +
      'Sentence 2: call out a funny contradiction or tell in their choices, roast-lite and kind.\n' +
      'Sentence 3: one tip for using their fonts, naming at least one of them.\n' +
      'Gen Z voice: casual and confident, slang only where it fits (lowkey, ate, no notes, it\'s giving, ' +
      'main character, the way you...). Do not restate the type name, list traits or invent anything not listed above.',

    // buildPrompt() · kind: 'compat'
    compat:
      'Two designers. {{a.name}} is {{a.type}} ({{describe(a.traits)}}). ' +
      '{{b.name}} is {{b.type}} ({{describe(b.traits)}}). Their match score is {{score}}%. ' +
      'In 1 or 2 short sentences (max 35 words), say playfully how they would work ' +
      'together on a poster: who does what, and where they might clash.',

    // buildPrompt() · kind: 'questions' (the scale list is filled in from TRAITS)
    questions:
      'Write 10 quick this-or-that questions for a designer personality quiz played by ' +
      'design students at a showcase. Gen Z tone, funny, about studio life, crits, Figma, ' +
      'moodboards, deadlines, group projects. 2 new questions for each of these 5 scales: ' +
      TRAITS.map((t, i) => `scale ${i + 1} = ${t[0]} vs ${t[1]}`).join('; ') + '. ' +
      'Each question has two answers, each written under the name of the personality it fits: ' +
      'the answer under "Futurist" must sound like a futurist, the one under "Nostalgic" like a nostalgic person, and so on. ' +
      'Question: max 34 characters. Each answer: max 30 characters. No placeholders. ' +
      'Reply with JSON only: {"questions": [ 10 objects, 2 per scale, shaped like: ' +
      TRAITS.map((t, i) => `{"scale": ${i + 1}, "question": string, "${t[0]}": string, "${t[1]}": string}`).join(' / ') + ' ] }',
  };

  // describe(traits) from api/ai.js
  W.PROMPTS.describe = traits => traits
    .map((v, i) => `${TRAITS[i][0]} ${Math.round((1 - v) * 100)}% / ${TRAITS[i][1]} ${Math.round(v * 100)}%`)
    .join('; ');
})();
