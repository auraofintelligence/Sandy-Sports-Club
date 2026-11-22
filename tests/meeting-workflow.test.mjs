import test from 'node:test';
import assert from 'node:assert/strict';
import {draftFromNotes, actionCalendar, memberMinuteCopy} from '../public/meeting-workflow.js';

test('minutes pull explicit decisions and dated jobs out of the original notes', () => {
  const notes = ['We agreed to test a portable beach volleyball court.',
    'The secretary will confirm the venue by 27 November 2026.',
    'The secretary will confirm the venue by 27 November 2026.',
    'Action: Ask about a family sport day.'].join('\n');
  const draft = draftFromNotes(notes);
  assert.deepEqual(draft.decisions, ['Test a portable beach volleyball court']);
  assert.deepEqual(draft.actions, [
    {text:'Confirm the venue',owner:'Secretary',dueDate:'2026-11-27',done:false},
    {text:'Ask about a family sport day',owner:'',dueDate:'',done:false},
  ]);
});

test('unagreed proposals and ambiguous due dates do not become approved dates', () => {
  const notes = 'Could we agree to this? The treasurer will not place an order. We plan to discuss a sale. Action: Check stock by 31/02/2026.';
  const draft = draftFromNotes(notes);
  assert.deepEqual(draft.decisions, []);
  assert.deepEqual(draft.actions,[{text:'Check stock by 31/02/2026',owner:'',dueDate:'',done:false}]);
});

test('calendar action carries an all-day due date, the same ID on repeated exports, and one reminder', () => {
  const job = {id:'job-17',text:'Organise the junior day,\nverify numbers',owner:'Secretary',dueDate:'2026-12-31'};
  const file = actionCalendar(job, true, new Date('2026-11-22T00:00:00Z'));
  assert.match(file,/UID:job-17@sandy-sports-clubhouse\r\n/);
  assert.match(file,/DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101/);
  assert.match(file,/TRIGGER:-P1D/);
  assert.match(file,/SUMMARY:Sandy practice: Organise the junior day\\,\\nverify numbers/);
  assert.throws(()=>actionCalendar({...job,dueDate:'2026-02-30'}));
  const long = actionCalendar({...job,text:'🐬'.repeat(100)});
  assert(long.split('\r\n').every(line=>Buffer.byteLength(line,'utf8')<=75));
});

test('member copy starts with decisions and omits lines containing contact details', () => {
  const lines = ['Run the next junior meet on 03/12/2026.', 'Ask the secretary at test@example.test.',
    'Confirm a collection by ringing 0400.123.456.', 'Use the landline (07) 3333 4444.', 'Open the next mixed sport session to families.'];
  assert.equal(memberMinuteCopy(lines),'• Run the next junior meet on 03/12/2026.\n• Open the next mixed sport session to families.');
});

