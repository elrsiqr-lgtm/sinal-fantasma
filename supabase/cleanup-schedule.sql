-- Sinal Fantasma: limpeza diária de partidas antigas
-- Cole no SQL Editor do Supabase e execute uma vez.
-- Pré-requisito: já ter rodado supabase/schema.sql (cria public.purge_old_games()).

-- O pg_cron precisa estar ligado. No Supabase também dá para ligar em
-- Database > Extensions > pg_cron.
create extension if not exists pg_cron;

-- Todo dia às 03:00 no horário de Brasília.
-- O pg_cron conta o horário em UTC, e Brasília é UTC-3 (sem horário de verão),
-- então 03:00 em Brasília = 06:00 em UTC.
-- Se rodar de novo com o mesmo nome, o agendamento é atualizado (não duplica).
select cron.schedule(
  'limpar-partidas-antigas',
  '0 6 * * *',
  'select public.purge_old_games();'
);

-- COMO CONFERIR QUE O AGENDAMENTO FOI CRIADO
-- Deve aparecer uma linha com o nome limpar-partidas-antigas, o horário
-- "0 6 * * *" e active = true:
--
--   select jobid, jobname, schedule, command, active
--   from cron.job
--   where jobname = 'limpar-partidas-antigas';
--
-- Depois do primeiro horário agendado, veja se rodou bem (status = succeeded):
--
--   select start_time, status, return_message
--   from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'limpar-partidas-antigas')
--   order by start_time desc
--   limit 5;

-- COMO DESFAZER (parar a limpeza automática)
-- Remove só este agendamento; a função purge_old_games() continua existindo:
--
--   select cron.unschedule('limpar-partidas-antigas');
