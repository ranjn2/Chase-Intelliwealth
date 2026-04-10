const POLICY_VIOLATION_PATTERNS: RegExp[] = [
  // PII / privacy violations
  /other\s*client|someone\s*else(?:'?s)?|another\s*(?:account|customer|client|person|user)/i,
  /\bssn\b|social\s*security|account\s*number|\bpii\b|date\s*of\s*birth|\bdob\b/i,
  /(?:show|give|tell|list|find|look\s*up|search|who).*(?:other|another|all)\s*(?:client|customer|account|user|people|investor)/i,
  /who\s+(?:else|also)\s+(?:invest|own|hold|bought)/i,
  /similar\s*(?:client|portfolio|customer|account)/i,

  // Abusive / hostile language
  /\b(fuck|shit|damn|ass|bitch|bastard|crap|dick|piss|stfu|wtf|asshole|dumbass|idiot|moron|retard)\b/i,
  /\b(kill|die|threat|bomb|attack|destroy|harm)\b.*\b(you|system|advisor|bank|chase)\b/i,

  // Illegal / unethical activity
  /insider\s*trad/i,
  /money\s*launder/i,
  /tax\s*evas(?:ion)?/i,
  /manipulat.*(?:market|stock|price)/i,
  /front\s*run/i,
  /pump\s*(?:and|&|n)\s*dump/i,
  /wash\s*trad/i,
  /ponzi|pyramid\s*scheme/i,
  /embezzl|fraud(?:ulent)?\s*(?:scheme|transfer|claim)/i,
  /brib(?:e|ery|ing)/i,
  /forge(?:ry|d)?\s*(?:document|signature|check)/i,

  // Prompt injection / social engineering
  /ignore\s*(?:previous|above|prior|your|all|the)\s*(?:instructions|prompt|rules|guidelines|constraints|directives)/i,
  /(?:you\s*are|act\s*as|roleplay\s*as|pretend\s*(?:to\s*be|you(?:'re)?)|behave\s*as|impersonate|simulate)\s*(?:a|an|the)?\s*(?:different|new|unrestricted|unfiltered|evil|rogue|hacked|jailbr)/i,
  /system\s*(?::|override|prompt|message|instruction)/i,
  /(?:new|override|change|update|replace|reset)\s*(?:your|the|system)\s*(?:prompt|instructions|rules|persona|role)/i,
  /(?:reveal|show|print|output|repeat|echo|display|dump)\s*(?:your|the|system|internal|hidden)\s*(?:prompt|instructions|rules|guidelines|configuration|config)/i,
  /\bDAN\b|do\s*anything\s*now|jailbreak|developer\s*mode|god\s*mode|sudo\s*mode/i,
  /\[(?:system|assistant|user)\]/i,

  // Specific regulated advice the system must not give
  /(?:file|prepare|complete|do|help.*(?:file|prepare))\s*(?:my|the|a|your)?\s*(?:tax\s*return|taxes|1040|w[- ]?2|1099)/i,
  /(?:advice|guidance|help|tips|how\s*to)\b.*\b(?:fil(?:e|ing)|prepar(?:e|ing)|complet(?:e|ing)|do(?:ing)?)\s+(?:my\s+|the\s+|a\s+|your\s+)?tax/i,
  /(?:specific|exact|precise)\s*tax\s*(?:advice|guidance|strategy|code|deduction|shelter)/i,
  /(?:how\s*(?:to|can\s*I))\s*(?:evade|avoid\s*paying|hide.*from)\s*(?:tax|irs|hmrc)/i,
  /\btax\s*(?:advice|filing|preparation|planning|return|strategy)\b/i,
  /legal\s*(?:advice|counsel|opinion|representation)/i,
  /(?:draft|write|prepare)\s*(?:a|my|the)\s*(?:will|trust|contract|power\s*of\s*attorney|legal\s*document)/i,
];

export const POLICY_VIOLATION_RESPONSE =
  "I'm unable to process this request. As a regulated financial advisor, I must adhere to our bank's internal policies, " +
  "which include strict obligations around client privacy, professional conduct, and legal compliance.\n\n" +
  "I cannot:\n" +
  "• Disclose information about other clients or accounts\n" +
  "• Engage with abusive or inappropriate language\n" +
  "• Provide specific tax filing, legal, or accounting advice\n" +
  "• Assist with any activity that may violate securities law or regulations\n" +
  "• Respond to attempts to override my safety guidelines\n\n" +
  "If you have a legitimate portfolio or investment question, I'm happy to help. " +
  "If you believe there's been a misunderstanding, please rephrase your question.";

export const OFF_TOPIC_RESPONSE =
  "I appreciate your question, but that falls outside the scope of investment and portfolio advisory. " +
  "I'm designed to help with topics like portfolio analysis, asset allocation, goal-based planning, " +
  "and investment recommendations. Feel free to ask me anything related to your portfolio or financial goals!";

export function isPolicyViolation(query: string): boolean {
  return POLICY_VIOLATION_PATTERNS.some((pattern) => pattern.test(query));
}
