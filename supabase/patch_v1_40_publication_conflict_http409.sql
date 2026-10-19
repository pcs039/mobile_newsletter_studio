-- Existing v1.40 installations only. Fresh installs use corrected schema_v1_40.
-- No tables, rows, signatures or grants are changed. Abort on unexpected bodies.
begin;
do $patch$
declare
 target regprocedure := to_regprocedure('public.transition_project_publication_atomic(uuid,text,text,text,text,uuid,text,text,text,boolean,text)');
 definition text; original_definition text; message text; old_raise text; new_raise text;
begin
 if target is null then raise exception 'v1_40_transition_missing'; end if;
 definition := pg_get_functiondef(target);
 original_definition := definition;
 foreach message in array array['publication_assignee_conflict','publication_key_conflict','publication_stale','publication_not_published','publication_status_conflict'] loop
  old_raise := format('raise exception %L using errcode=%L',message,'40001');
  new_raise := format('raise exception %L using errcode=%L',message,'PT409');
  if length(definition)-length(replace(definition,old_raise,'')) = length(old_raise)
     and position(new_raise in definition)=0 then
   definition := replace(definition,old_raise,new_raise);
  elsif length(definition)-length(replace(definition,new_raise,'')) = length(new_raise)
     and position(old_raise in definition)=0 then
   null; -- Already corrected: idempotent, no function replacement required.
  else
   raise exception 'unexpected_v1_40_conflict_definition: %',message;
  end if;
 end loop;
 if definition is distinct from original_definition then execute definition; end if;
end;
$patch$;
notify pgrst, 'reload schema';
commit;
