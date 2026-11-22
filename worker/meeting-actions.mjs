// When an action is carried to a later meeting, its most recent confirmed copy
// determines both ownership and whether the work is still open.
export const currentMeetingActions=`WITH assignments AS (
  SELECT r.id AS meetingId,r.title AS meetingTitle,json_extract(j.value,'$.id') AS id,
    json_extract(j.value,'$.text') AS text,json_extract(j.value,'$.owner') AS owner,
    json_extract(j.value,'$.dueDate') AS dueDate,json_extract(j.value,'$.done') AS done,
    n.version AS version,j.key AS position,
    row_number() OVER(PARTITION BY json_extract(j.value,'$.id') ORDER BY r.date DESC,r.time DESC,n.approved_at DESC,r.id DESC) AS newest
  FROM meeting_register r JOIN meeting_notes n ON n.id=r.id JOIN json_each(n.actions_json) j
  WHERE n.status='approved' AND json_extract(j.value,'$.id') IS NOT NULL)
  SELECT * FROM assignments WHERE newest=1`;
