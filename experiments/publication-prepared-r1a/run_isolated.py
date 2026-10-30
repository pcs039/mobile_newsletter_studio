#!/usr/bin/env python3
"""Synthetic PostgreSQL fixture/measurement runner, never an app transport.

Hard-coded private socket and data_directory check. No network/env/credentials,
Supabase, migrations, Storage or TTS. Requires an already started isolated PG17.
"""
import hashlib, json, os, pathlib, re, statistics, subprocess, time, sys

ROOT = pathlib.Path(__file__).resolve().parent
PSQL = '/opt/homebrew/opt/postgresql@17/bin/psql'
SOCKET = '/private/tmp/prepared-r1a-socket'
DATA = '/private/tmp/prepared-r1a-pg'
OUT = pathlib.Path('/private/tmp/prepared-r1a-results')
OUT.mkdir(mode=0o700, exist_ok=True)
ENV = {'PATH': '/opt/homebrew/bin:/usr/bin:/bin', 'LC_ALL': 'C'}

class DB:
    def __init__(self):
        self.p = subprocess.Popen([PSQL, '-X', '-h', SOCKET, '-p', '55489', '-d', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=ENV)
        assert self.q("SELECT current_setting('data_directory'),inet_server_addr() IS NULL,current_setting('server_version_num')::int/10000;") == [DATA+'|t|17'], 'Not the dedicated isolated PostgreSQL 17'
        self.q("SET TimeZone='UTC'; SET jit=off; SET max_parallel_workers_per_gather=0; SET track_io_timing=on; SET statement_timeout='30s';")
    def q(self, sql):
        self.p.stdin.write(sql+'\nSELECT \'__R1A_END__\';\n'); self.p.stdin.flush()
        rows=[]
        while True:
            line=self.p.stdout.readline()
            if not line:
                raise RuntimeError(self.p.stderr.read())
            if line.rstrip('\n')=='__R1A_END__': return rows
            rows.append(line.rstrip('\n'))
    def close(self):
        if self.p.poll() is None:
            self.p.stdin.write('\\q\n'); self.p.stdin.flush(); self.p.wait(timeout=5)

def uid(n):
    import hashlib
    s=hashlib.md5(('r1a-synthetic:'+str(n)).encode()).hexdigest()
    return s[:8]+'-'+s[8:12]+'-'+s[12:16]+'-'+s[16:20]+'-'+s[20:]

NOW="'2026-10-30T00:00:00Z'"
def args(project=1, scope='regular', ids='NULL', renderer='sample-v289', at=NOW):
    return f"'{uid(project)}'::uuid,'{scope}',{ids}::uuid[],{at}::timestamptz,'{renderer}'"
def call(project=1, **kw): return 'r1a.source_digest('+args(project, **kw)+')'
def dig(db, project=1, **kw): return db.q('SELECT source_digest FROM '+call(project,**kw)+';')[0]
def cpu(pid):
    s=subprocess.check_output(['/bin/ps','-p',str(pid),'-o','time='], text=True).strip()
    vals=[float(x) for x in s.split(':')]
    return sum(v*60**i for i,v in enumerate(reversed(vals)))

def baseline(project, scope='regular', ids='NULL'):
    # SQL-side workload analogue, not exact PostgREST JSON or network schedule.
    pid=f"'{uid(project)}'::uuid"
    filt=f"project_id={pid}"+(f" AND id=ANY({ids}::uuid[])" if scope=='demo' else '')
    selected=f'SELECT id FROM r1a.newsletter_articles WHERE {filt}'
    comp=f'SELECT id FROM r1a.newsletter_article_compositions WHERE project_id={pid} AND article_id IN({selected})'
    queries=[
      f'SELECT to_jsonb(s) FROM r1a.newsletter_project_demo_shares s WHERE project_id={pid}',
      f"SELECT jsonb_build_object('project',to_jsonb(p),'articles',(SELECT jsonb_agg(to_jsonb(a)||jsonb_build_object('blocks',(SELECT jsonb_agg(to_jsonb(b))FROM r1a.newsletter_content_blocks b WHERE b.article_id=a.id),'links',(SELECT jsonb_agg(to_jsonb(l))FROM r1a.newsletter_link_actions l WHERE l.article_id=a.id))) FROM r1a.newsletter_articles a WHERE a.project_id=p.id),'audio',(SELECT jsonb_agg(to_jsonb(x))FROM r1a.newsletter_audio_files x WHERE x.project_id=p.id))FROM r1a.newsletter_projects p WHERE p.id={pid}",
      f'SELECT id,status,publication_kind,valid_from,valid_until FROM r1a.newsletter_articles WHERE {filt}',
      f'SELECT article_id,status,settings FROM r1a.newsletter_article_compositions WHERE project_id={pid} AND article_id IN({selected})',
      f'SELECT id,status,publication_kind,valid_from,valid_until FROM r1a.newsletter_articles WHERE {filt}',
      f"SELECT id,article_id FROM r1a.newsletter_article_compositions WHERE project_id={pid} AND article_id IN({selected}) AND status='ready'",
      f'SELECT composition_id,asset_id,settings FROM r1a.newsletter_article_composition_assets WHERE composition_id IN({comp})',
      f'SELECT id,storage_path FROM r1a.newsletter_project_design_assets WHERE project_id={pid} AND id IN(SELECT asset_id FROM r1a.newsletter_article_composition_assets WHERE composition_id IN({comp}))',
      f'SELECT project_id,storage_path,storage_bucket,mime_type,file_size_bytes,is_active FROM r1a.newsletter_project_design_assets WHERE project_id={pid} AND storage_path=(SELECT cover_image_path FROM r1a.newsletter_projects WHERE id={pid})',
      f"SELECT * FROM r1a.newsletter_audio_files WHERE project_id={pid} AND title LIKE '[시연 TTS v3] %'",
      f"SELECT * FROM r1a.newsletter_audio_files WHERE project_id={pid} AND (title LIKE '[만평 성우 시험 v1] %' OR title LIKE '[만평 성우 시험 v2] %')",
      'SELECT to_jsonb(f)||jsonb_build_object(\'family\',to_jsonb(fa)) FROM r1a.font_assets f LEFT JOIN r1a.font_families fa ON fa.id=f.family_id WHERE f.is_active AND f.webfont_allowed',
    ]
    return queries

def explain(db, sql):
    data=json.loads('\n'.join(db.q('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+sql+';')))[0]
    def counts(n):
        out={n['Node Type']:1}
        for child in n.get('Plans',[]):
            for k,v in counts(child).items():out[k]=out.get(k,0)+v
        return out
    return {'planning_ms':data['Planning Time'],'execution_ms':data['Execution Time'],
            'shared_hit_blocks':data['Plan'].get('Shared Hit Blocks',0),'shared_read_blocks':data['Plan'].get('Shared Read Blocks',0),
            'temp_written_blocks':data['Plan'].get('Temp Written Blocks',0),'nodes':counts(data['Plan']),'plan':data}

def record(output):
    """Record numeric synthetic evidence, not live content or credentials."""
    report={k:v for k,v in output.items()if k not in ('benchmarks','unrelated_growth')}
    report['projection_sha256']=hashlib.sha256((ROOT/'projection.sql').read_bytes()).hexdigest()
    report['benchmarks']=[{k:v for k,v in item.items()if k!='first_plans'}for item in output['benchmarks']]
    report['unrelated_growth']=[{k:v for k,v in item.items()if k!='first_plan'}for item in output['unrelated_growth']]
    plans={}
    for item in output['benchmarks']:
        if item['workload']=='projection':plans[str(item['articles'])+'_projection']=item['first_plans'][0]['plan']
        if item['workload']=='dynamic_sql_analogue':plans[str(item['articles'])+'_source_analogue']=item['first_plans'][1]['plan']
    for item in output['unrelated_growth']:plans['noise_indexed_'+str(item['candidate_indexes'])]=item['first_plan']['plan']
    (ROOT/'measurements.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    (ROOT/'explain-plans.json').write_text(json.dumps(plans,separators=(',',':'),ensure_ascii=False)+'\n')

def main():
    db=DB()
    if db.q("SELECT count(*) FROM pg_namespace WHERE nspname='r1a';")!=['0']:
        assert sys.argv[1:]==['--reset-synthetic'], 'Fixture exists; explicit local synthetic reset required'
        db.q('DROP SCHEMA r1a CASCADE;')
    db.q((ROOT/'fixture.sql').read_text())
    query=(ROOT/'projection.sql').read_text().strip().rstrip(';')
    db.q("CREATE FUNCTION r1a.source_digest(uuid,text,uuid[],timestamptz,text) RETURNS TABLE(source_digest text,source_bytes int,dependencies jsonb,cacheable boolean,access_contract text,media_reuse text) LANGUAGE sql STABLE SET TimeZone='UTC' AS $r1a$"+query+'$r1a$;')
    db.q('PREPARE dep(uuid,text,uuid[],timestamptz,text) AS '+query+';')
    tests=[]
    def test(name, mutate, changed=True, project=1, **kw):
        old=dig(db,project,**kw);db.q('BEGIN;'+mutate);new=dig(db,project,**kw);db.q('ROLLBACK;')
        assert (new!=old)==changed, name
        tests.append({'name':name,'passed':True})
    aid=uid(100001)
    test('article_title',f"UPDATE r1a.newsletter_articles SET title='changed' WHERE id='{aid}';")
    test('block_metadata_parent_timestamp_unchanged',f"UPDATE r1a.newsletter_content_blocks SET metadata=metadata||'{{\"r1a\":true}}' WHERE article_id='{aid}';")
    test('new_article',f"INSERT INTO r1a.newsletter_articles(id,project_id,title,sort_order) VALUES(r1a.uid(99999),r1a.uid(1),'new',5);")
    test('delete_article',f"DELETE FROM r1a.newsletter_articles WHERE id='{aid}';")
    test('new_link',f"INSERT INTO r1a.newsletter_link_actions(id,project_id,article_id,sort_order,label) VALUES(r1a.uid(88888),r1a.uid(1),'{aid}',20,'new');")
    test('composition_without_parent_timestamp',f"UPDATE r1a.newsletter_article_compositions SET settings=settings||'{{\"textDesign\":{{\"subtitle\":\"changed\"}}}}' WHERE article_id='{aid}';")
    test('new_placement',f"INSERT INTO r1a.newsletter_article_composition_assets(id,composition_id,asset_id,slot,sort_order,settings,is_visible) SELECT r1a.uid(77777),id,r1a.uid(4000001),'footer_banner',20,'{{}}',true FROM r1a.newsletter_article_compositions WHERE article_id='{aid}';")
    test('font_disabled',"UPDATE r1a.font_assets SET is_active=false WHERE id=r1a.uid(20001);")
    test('family_changed',"UPDATE r1a.font_families SET css_family_name='changed' WHERE id=r1a.uid(10001);")
    test('design_disabled',f"UPDATE r1a.newsletter_project_design_assets SET is_active=false WHERE id IN(SELECT asset_id FROM r1a.newsletter_article_composition_assets WHERE composition_id IN(SELECT id FROM r1a.newsletter_article_compositions WHERE article_id='{aid}'));")
    test('audio_selection',"UPDATE r1a.newsletter_audio_files SET script_status='approved',pronunciation_note='new adoption' WHERE id=r1a.uid(7000001);")
    test('new_audio_candidate',"INSERT INTO r1a.newsletter_audio_files(id,project_id,title,script_status) VALUES(r1a.uid(55555),r1a.uid(1),'[만평 성우 시험 v1] new','approved');")
    test('article_order',f"UPDATE r1a.newsletter_articles SET sort_order=999 WHERE id='{aid}';")
    test('project_title',"UPDATE r1a.newsletter_projects SET title='changed issue' WHERE id=r1a.uid(1);")
    test('article_body',f"UPDATE r1a.newsletter_articles SET body='changed body' WHERE id='{aid}';")
    test('block_deleted',f"DELETE FROM r1a.newsletter_content_blocks WHERE article_id='{aid}' AND sort_order=10;")
    test('link_deleted',f"DELETE FROM r1a.newsletter_link_actions WHERE article_id='{aid}';")
    test('composition_status',f"UPDATE r1a.newsletter_article_compositions SET status='draft' WHERE article_id='{aid}';")
    test('asset_reference',f"INSERT INTO r1a.newsletter_assets VALUES(r1a.uid(33332),r1a.uid(1),'new.webp',true,'image/webp'); UPDATE r1a.newsletter_content_blocks SET asset_id=r1a.uid(33332) WHERE article_id='{aid}' AND sort_order=10;")
    test('design_kit',"INSERT INTO r1a.newsletter_project_design_kits VALUES(r1a.uid(33331),r1a.uid(1),'Family1','Family2','#ffffff');")
    test('project_home',"INSERT INTO r1a.newsletter_project_home_settings VALUES(r1a.uid(1),true,ARRAY['동부'],'[]');")
    test('article_home',f"INSERT INTO r1a.newsletter_article_home_metadata VALUES('{aid}',r1a.uid(1),ARRAY['동부'],'event');")
    page_setup=f"INSERT INTO r1a.newsletter_pages VALUES(r1a.uid(33330),r1a.uid(1),1,'page','page.webp','ready'); UPDATE r1a.newsletter_articles SET page_id=r1a.uid(33330) WHERE id='{aid}';"
    test('page',page_setup)
    test('hotspot',page_setup+"INSERT INTO r1a.newsletter_page_hotspot_links VALUES(r1a.uid(33329),r1a.uid(1),r1a.uid(33330),10,true,'https://example.invalid');")
    test('link_area',page_setup+"INSERT INTO r1a.newsletter_link_areas VALUES(r1a.uid(33328),r1a.uid(1),r1a.uid(33330),'{\"target\":\"fixture\"}');")
    overlay_setup=f"INSERT INTO r1a.newsletter_link_actions VALUES(r1a.uid(33327),r1a.uid(1),NULL,'overlay','external_url','https://example.invalid/old','button',10,true); INSERT INTO r1a.newsletter_image_overlays VALUES(r1a.uid(33326),r1a.uid(1),'{aid}',NULL,NULL,r1a.uid(33327),'{{}}');"
    db.q('BEGIN;'+overlay_setup);before=dig(db);db.q("UPDATE r1a.newsletter_link_actions SET target_value='https://example.invalid/new' WHERE id=r1a.uid(33327);");assert dig(db)!=before;db.q('ROLLBACK;');tests.append({'name':'overlay_link_without_article_id','passed':True})
    test('other_project_isolation',"UPDATE r1a.newsletter_articles SET title='other' WHERE project_id=r1a.uid(3);",False)
    test('unused_font_excluded',"UPDATE r1a.font_assets SET font_name='unused' WHERE id=r1a.uid(20040);",False)
    test('same_family_new_face',"INSERT INTO r1a.font_assets(id,family_id,font_file_path)VALUES(r1a.uid(66666),r1a.uid(10001),'new.woff2');")
    test('new_font_reference',f"UPDATE r1a.newsletter_article_compositions SET settings=jsonb_build_object('fontDesign',jsonb_build_object('body',r1a.uid(20040))) WHERE article_id='{aid}';")
    db.q(f"BEGIN;UPDATE r1a.newsletter_article_compositions SET settings='{{\"x\":1,\"y\":2}}' WHERE article_id='{aid}';")
    before=dig(db);db.q(f"UPDATE r1a.newsletter_article_compositions SET settings='{{\"y\":2,\"x\":1}}' WHERE article_id='{aid}';");assert dig(db)==before;db.q('ROLLBACK;');tests.append({'name':'JSONB_key_order_deterministic','passed':True})
    db.q('BEGIN;')
    parent=db.q(f"SELECT updated_at FROM r1a.newsletter_articles WHERE id='{aid}';")
    db.q(f"UPDATE r1a.newsletter_content_blocks SET body='child only' WHERE article_id='{aid}';UPDATE r1a.newsletter_article_compositions SET settings='{{\"child\":true}}' WHERE article_id='{aid}';")
    assert db.q(f"SELECT updated_at FROM r1a.newsletter_articles WHERE id='{aid}';")==parent
    db.q('ROLLBACK;');tests.append({'name':'parent_updated_at_actually_unchanged','passed':True})
    assert db.q('SELECT cacheable FROM '+call(renderer='unknown-renderer')+';')==['f'];tests.append({'name':'unknown_renderer_not_usable','passed':True})
    test('unused_design_excluded',"INSERT INTO r1a.newsletter_project_design_assets(id,project_id,asset_type,storage_path)VALUES(r1a.uid(44444),r1a.uid(1),'illustration','unused.webp');",False)
    test('new_logo_candidate',"INSERT INTO r1a.newsletter_project_design_assets(id,project_id,asset_type,storage_path)VALUES(r1a.uid(44444),r1a.uid(1),'logo','logo.svg');")
    test('url_encoded_design_reference',f"INSERT INTO r1a.newsletter_project_design_assets(id,project_id,asset_type,storage_path)VALUES(r1a.uid(44444),r1a.uid(1),'illustration','projects/{uid(1)}/extra.webp'); UPDATE r1a.newsletter_content_blocks SET body='/api/project-files/preview?bucket=design-production-assets&path=projects%2F{uid(1)}%2Fextra.webp' WHERE article_id='{aid}';")
    ids=f"ARRAY['{aid}']";test('Demo_unselected_article_excluded',f"UPDATE r1a.newsletter_articles SET body='not selected' WHERE project_id=r1a.uid(1) AND id<>'{aid}';",False,scope='demo',ids=ids)
    assert db.q('SELECT cacheable FROM '+call(scope='demo',ids=f"ARRAY['{uid(300001)}']")+';')==['f'];tests.append({'name':'cross_project_Demo_selection_rejected','passed':True})
    old=dig(db);db.q("SET TimeZone='Asia/Seoul';");assert dig(db)==old;db.q("SET TimeZone='UTC';");tests.append({'name':'deterministic_across_timezone','passed':True})
    assert dig(db)==dig(db);tests.append({'name':'deterministic_identical_source','passed':True})
    test('regular_private_not_content_authority',"UPDATE r1a.newsletter_projects SET status='private' WHERE id=r1a.uid(1);",False)
    test('Demo_revoke_not_content_authority',"UPDATE r1a.newsletter_project_demo_shares SET revoked_at=now() WHERE project_id=r1a.uid(1);",False)
    test('legacy_Demo_snapshot_not_new_digest',"UPDATE r1a.newsletter_project_demo_shares SET source_snapshot='different legacy snapshot' WHERE project_id=r1a.uid(1);",False)
    assert db.q('SELECT access_contract,media_reuse FROM '+call()+';')==['NOT_AUTHORIZATION|dynamic_only']
    # Inclusive rolling boundary: the clock itself is not part of the hash.
    db.q(f"BEGIN; UPDATE r1a.newsletter_articles SET publication_kind='rolling',status='published',valid_until='2026-10-30T00:00Z' WHERE id='{aid}';")
    before=dig(db,at="'2026-10-29T23:59:59Z'");at=dig(db);after=dig(db,at="'2026-10-30T00:00:00.001Z'");assert before==at and at!=after;db.q('ROLLBACK;');tests.append({'name':'rolling_inclusive_end_boundary','passed':True})
    db.q(f"BEGIN; INSERT INTO r1a.newsletter_content_blocks SELECT r1a.uid(33333),project_id,article_id,block_type,title,body,text_alignment,asset_id,link_action_id,sort_order,metadata,is_visible,updated_at FROM r1a.newsletter_content_blocks WHERE article_id='{aid}' AND sort_order=10;")
    assert db.q('SELECT cacheable FROM '+call()+';')==['f'];db.q('ROLLBACK;');tests.append({'name':'ambiguous_block_order_disables_HIT','passed':True})

    # One PostgreSQL statement spans a committed two-table edit. STABLE function
    # sees the outer query snapshot; separate READ COMMITTED statements do not.
    reader=DB();writer=DB();old=dig(db)
    reader_pid=int(reader.q('SELECT pg_backend_pid();')[0])
    old_title=reader.q(f"SELECT title FROM r1a.newsletter_articles WHERE id='{aid}';")
    writer.q('SELECT pg_advisory_lock(991234);')
    reader.p.stdin.write("SELECT result.source_digest FROM (SELECT pg_advisory_xact_lock(991234)) barrier CROSS JOIN LATERAL "+call()+" AS result;\nSELECT '__R1A_END__';\n");reader.p.stdin.flush()
    for _ in range(100):
        if writer.q(f"SELECT coalesce(wait_event_type='Lock',false) FROM pg_stat_activity WHERE pid={reader_pid};")==['t']:break
        time.sleep(.01)
    else:raise AssertionError('Reader was not observed blocked inside its statement')
    writer.q(f"BEGIN; UPDATE r1a.newsletter_articles SET title='atomic new' WHERE id='{aid}';UPDATE r1a.newsletter_article_compositions SET settings='{{\"atomic\":\"new\"}}' WHERE article_id='{aid}';COMMIT;SELECT pg_advisory_unlock(991234);")
    vals=[]
    while True:
        line=reader.p.stdout.readline().strip()
        if line=='__R1A_END__':break
        if not line:raise RuntimeError(reader.p.stderr.read())
        vals.append(line)
    assert vals==[old],vals
    assert dig(db)!=old;tests.append({'name':'single_statement_MVCC_during_atomic_edit','passed':True})
    assert old_title!=reader.q(f"SELECT title FROM r1a.newsletter_articles WHERE id='{aid}';")
    assert reader.q(f"SELECT settings->>'atomic' FROM r1a.newsletter_article_compositions WHERE article_id='{aid}';")==['new']
    tests.append({'name':'separate_statement_control_sees_new_edit','passed':True})
    reader.close();writer.close()
    # Restore fixture edits before measurement.
    db.q(f"UPDATE r1a.newsletter_articles SET title='Synthetic article 1' WHERE id='{aid}';UPDATE r1a.newsletter_article_compositions SET settings=jsonb_build_object('fontDesign',jsonb_build_object('subheading',r1a.uid(20004))) WHERE article_id='{aid}';ANALYZE;")
    results=[];pid=int(db.q('SELECT pg_backend_pid();')[0])
    for project in (1,2):
        projected='EXECUTE dep('+args(project)+')'
        base=baseline(project)
        workloads={'projection':[projected],'dynamic_sql_analogue':base,'Demo_gate_plus_projection':base[:2]+[projected]}
        for name,queries in workloads.items():
            plans=[];wire=0
            for q in queries:
                db.q(q+';')
            for i in range(5):
                plan=[explain(db,q)for q in queries];plans.append(plan)
                if i==0:wire=sum(sum(len(x.encode())+1 for x in db.q(q+';'))for q in queries)
            reps=30 if project==1 else 8
            start=cpu(pid);wall=time.perf_counter()
            for _ in range(reps):
                db.q(';'.join(queries)+';')
            wall=time.perf_counter()-wall;cpu_delta=cpu(pid)-start
            executions=[sum(x['execution_ms']for x in row)for row in plans]
            result={'articles':7 if project==1 else 700,'workload':name,'sql_statements':len(queries),'execution_ms_samples':executions,'execution_ms_median':statistics.median(executions),'planning_ms_median':statistics.median(sum(x['planning_ms']for x in row)for row in plans),'shared_hit_blocks_median':statistics.median(sum(x['shared_hit_blocks']for x in row)for row in plans),'shared_read_blocks_median':statistics.median(sum(x['shared_read_blocks']for x in row)for row in plans),'returned_psql_text_bytes':wire,'backend_cpu_batch_seconds':cpu_delta,'cpu_batch_repetitions':reps,'backend_cpu_ms_per_iteration':cpu_delta*1000/reps,'batch_wall_seconds':wall,'first_plans':plans[0]}
            results.append(result)
    # Unrelated library growth must not change the source. Its scan cost still
    # matters, so compare real plans, not just the returned dependency count.
    original=dig(db)
    db.q("INSERT INTO r1a.font_families SELECT r1a.uid(50000000+i),'Noise'||i,'Noise'||i,'Noise',true,true FROM generate_series(1,5000)i; INSERT INTO r1a.font_assets(id,family_id,font_name,font_file_path,is_active,webfont_allowed) SELECT r1a.uid(60000000+i),r1a.uid(50000000+i),'Noise','noise/'||i||'.woff2',true,true FROM generate_series(1,5000)i; INSERT INTO r1a.newsletter_project_design_assets(id,project_id,asset_type,storage_path)SELECT r1a.uid(70000000+i),r1a.uid(1),'illustration','unused/'||i||'.webp' FROM generate_series(1,5000)i;ANALYZE;")
    assert dig(db)==original;tests.append({'name':'5000_unrelated_fonts_families_designs_excluded','passed':True})
    noise=[]
    for indexed in (False,True):
        if indexed:
            # Candidate indexes on the fixture only, never remote DDL.
            db.q('CREATE INDEX ON r1a.newsletter_project_design_assets(project_id,storage_path);CREATE INDEX ON r1a.font_families(family_name);ANALYZE;')
        plans=[explain(db,'EXECUTE dep('+args()+')')for _ in range(5)]
        noise.append({'candidate_indexes':indexed,'execution_ms_samples':[x['execution_ms']for x in plans],'median_ms':statistics.median(x['execution_ms']for x in plans),'shared_hit_blocks_median':statistics.median(x['shared_hit_blocks']for x in plans),'first_plan':plans[0]})
    output={'postgres':db.q('SELECT version();')[0],'source_base':'b76322e','remote_connections':0,'fixture':'synthetic 7/700 articles with 5 blocks each + 1500 unrelated; 289 faces/243 families; separate +5000 noise experiment','tests':tests,'benchmarks':results,'unrelated_growth':noise,'limitations':['Warm local DB buffers; no forced disk cold cache','SQL baseline analogue, not exact PostgREST JSON or HTTP','Backend CPU from macOS ps cumulative centiseconds; no parallel workers','No prepared tables/head lookup, Storage identity or end-to-end browser measured','Projection is not authorization; legacy Demo hash remains external']}
    (OUT/'results.json').write_text(json.dumps(output,indent=2,ensure_ascii=False));os.chmod(OUT/'results.json',0o600)
    record(output)
    print(json.dumps({'passed':len(tests),'benchmarks':[{k:v for k,v in x.items()if k!='first_plans'}for x in results],'noise':[{k:v for k,v in x.items()if k!='first_plan'}for x in noise]},ensure_ascii=False))
    db.close()

if __name__=='__main__':main()
