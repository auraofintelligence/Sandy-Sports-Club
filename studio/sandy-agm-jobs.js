// Default AGM preparation jobs for Sandy Sports. These are planning prompts only.
// Offsets are days relative to the AGM date (negative = before). They are NOT legal
// advice: the owner must confirm every deadline against the adopted constitution and
// Queensland incorporated association requirements before relying on them.
export const AGM_JOBS_STATUS='Defaults pending owner and constitution confirmation';
export const AGM_JOBS=Object.freeze([
 {key:'venue',title:'Confirm AGM venue and accessibility',office:'secretary',offset:-42},
 {key:'accounts',title:'Prepare annual financial statements for review',office:'treasurer',offset:-35},
 {key:'review',title:'Arrange financial review or audit if the adopted rules require it',office:'treasurer',offset:-28},
 {key:'notice',title:'Issue notice of AGM and agenda to members, saying it is recorded on video and audio, archived and streamed to members (rule 4B; check notice period)',office:'secretary',offset:-21},
 {key:'nominations-open',title:'Open nominations for committee positions',office:'secretary',offset:-21},
 {key:'nominations-close',title:'Close nominations and prepare ballot if needed',office:'secretary',offset:-7},
 {key:'president-report',title:'Prepare President annual report',office:'president',offset:-7},
 {key:'previous-minutes',title:'Circulate previous AGM minutes for confirmation',office:'secretary',offset:-7},
 {key:'proceedings',title:'Draft AGM proceedings and election results',office:'secretary',offset:7},
 {key:'annual-return',title:'Check and lodge any annual return required for an incorporated association',office:'secretary',offset:30}
].map(Object.freeze));
