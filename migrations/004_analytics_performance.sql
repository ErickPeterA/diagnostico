BEGIN;
-- Índices compostos usados pelos filtros e agregações da camada analítica.
CREATE INDEX idx_interviews_completed_diagnostic ON interviews(diagnostic_id, id) WHERE status='completed';
CREATE INDEX idx_answers_interview_question_option ON answers(interview_id, question_id, answer_option_id);
CREATE INDEX idx_answers_related_person ON answers(related_person_id, interview_id) WHERE related_person_id IS NOT NULL;
CREATE INDEX idx_interview_people_person_interview ON interview_people(person_id, interview_id);
CREATE INDEX idx_comments_answer ON comments(answer_id);
CREATE INDEX idx_classifications_comment_review ON comment_classifications(comment_id, review_status);
INSERT INTO schema_migrations(version) VALUES ('004_analytics_performance.sql');
COMMIT;
