-- Planos de ação passam a ser acompanhados por prioridade, sem prazo obrigatório.
ALTER TABLE action_plans ALTER COLUMN due_date DROP NOT NULL;
