import React, { useState, useEffect } from 'react';
import { supabase, hasSupabaseConfig } from '../lib/supabase';
import type { Question } from '../types';
import { Plus, Trash2, Edit3, ArrowLeft, Save, X, Lock } from 'lucide-react';

interface AdminViewProps {
  onBack: () => void;
}

const DEFAULT_MOCK_QUESTIONS: Question[] = [
  {
    id: 'mock-1',
    question_text: 'Which historical monument in Daura is associated with the slaying of the legendary snake Sarki?',
    options: ['Kusugu Well', 'Emir’s Palace', 'Gezo Well', 'Kogi Gate'],
    correct_index: 0
  },
  {
    id: 'mock-2',
    question_text: 'In parliamentary terminology, what refers to the minimum number of members required to conduct business?',
    options: ['Forum', 'Quorum', 'Division', 'Conclave'],
    correct_index: 1
  },
  {
    id: 'mock-3',
    question_text: 'Who is widely regarded as the first female monarch of the Daura Kingdom?',
    options: ['Queen Amina', 'Queen Daurama', 'Kufuru', 'Queen Zaria'],
    correct_index: 1
  },
  {
    id: 'mock-4',
    question_text: 'What is the designation given to a legislative proposal before it is passed into a law or act?',
    options: ['Motion', 'Statute', 'Bill', 'Resolution'],
    correct_index: 2
  }
];

export const AdminView: React.FC<AdminViewProps> = ({ onBack }) => {
  const [passcode, setPasscode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState<number>(0);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchQuestions();
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === 'daura2026') {
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('Incorrect passcode! Please try again.');
    }
  };

  const fetchQuestions = async () => {
    setLoading(true);
    if (!hasSupabaseConfig) {
      // Sandbox: load from local storage or default mocks
      const local = localStorage.getItem('order_trivia_mock_questions');
      if (local) {
        setQuestions(JSON.parse(local));
      } else {
        setQuestions(DEFAULT_MOCK_QUESTIONS);
        localStorage.setItem('order_trivia_mock_questions', JSON.stringify(DEFAULT_MOCK_QUESTIONS));
      }
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchErr } = await supabase
        .from('questions')
        .select('*')
        .order('created_at', { ascending: true });

      if (fetchErr) throw fetchErr;
      setQuestions(data || []);
    } catch (err: any) {
      setError(err.message || 'Error fetching questions');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim() || options.some(opt => !opt.trim())) {
      setError('Please fill in all options and the question text.');
      return;
    }

    setLoading(true);
    setError('');

    const questionData = {
      question_text: questionText,
      options,
      correct_index: correctIndex,
    };

    if (!hasSupabaseConfig) {
      // Sandbox: CRUD locally
      let updatedQuestions = [...questions];
      if (editingId) {
        updatedQuestions = updatedQuestions.map(q => 
          q.id === editingId ? { ...q, ...questionData } : q
        );
      } else {
        updatedQuestions.push({
          id: 'mock-' + Math.random().toString(36).substr(2, 9),
          ...questionData
        });
      }

      setQuestions(updatedQuestions);
      localStorage.setItem('order_trivia_mock_questions', JSON.stringify(updatedQuestions));
      resetForm();
      setLoading(false);
      return;
    }

    try {
      if (editingId) {
        const { error: saveErr } = await supabase
          .from('questions')
          .update(questionData)
          .eq('id', editingId);

        if (saveErr) throw saveErr;
      } else {
        const { error: saveErr } = await supabase
          .from('questions')
          .insert([questionData]);

        if (saveErr) throw saveErr;
      }

      resetForm();
      fetchQuestions();
    } catch (err: any) {
      setError(err.message || 'Error saving question');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (q: Question) => {
    setEditingId(q.id);
    setQuestionText(q.question_text);
    setOptions([...q.options]);
    setCorrectIndex(q.correct_index);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    setLoading(true);

    if (!hasSupabaseConfig) {
      const updated = questions.filter(q => q.id !== id);
      setQuestions(updated);
      localStorage.setItem('order_trivia_mock_questions', JSON.stringify(updated));
      setLoading(false);
      return;
    }

    try {
      const { error: delErr } = await supabase
        .from('questions')
        .delete()
        .eq('id', id);

      if (delErr) throw delErr;
      fetchQuestions();
    } catch (err: any) {
      setError(err.message || 'Error deleting question');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setQuestionText('');
    setOptions(['', '', '', '']);
    setCorrectIndex(0);
    setIsAdding(false);
  };

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  if (!isAuthenticated) {
    return (
      <div className="player-layout">
        <div className="join-card">
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <Lock size={48} style={{ color: 'var(--gold)', marginBottom: '1rem', marginInline: 'auto' }} />
            <h2>Admin Passcode</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Enter passcode to manage questions</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Passcode</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={passcode}
                onChange={e => setPasscode(e.target.value)}
                autoFocus
              />
            </div>
            {authError && (
              <p style={{ color: 'var(--color-red)', marginBottom: '1rem', fontWeight: 600 }}>
                {authError}
              </p>
            )}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={onBack} style={{ flex: 1 }}>
                <ArrowLeft size={18} /> Cancel
              </button>
              <button type="submit" className="btn btn-gold" style={{ flex: 2 }}>
                Unlock
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '900px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={18} /> Exit Admin
        </button>
        <h2 style={{ color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Question Bank Management {!hasSupabaseConfig && '• Sandbox'}
        </h2>
        {!isAdding && (
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
            <Plus size={18} /> New Question
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: 'rgba(226, 27, 60, 0.1)', border: '1px solid var(--color-red)', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
          {error}
        </div>
      )}

      {isAdding ? (
        <div className="join-card" style={{ marginTop: 0, borderTop: '4px solid var(--primary)' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>{editingId ? 'Edit Question' : 'Create New Question'}</h3>
          <form onSubmit={handleSaveQuestion}>
            <div className="form-group">
              <label>Question Text</label>
              <input
                type="text"
                className="form-input"
                style={{ textAlign: 'left' }}
                value={questionText}
                onChange={e => setQuestionText(e.target.value)}
                placeholder="Enter the trivia question..."
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              {options.map((option, idx) => (
                <div key={idx} className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Option {idx + 1}</span>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', cursor: 'pointer', textTransform: 'none' }}>
                      <input
                        type="radio"
                        name="correctIndex"
                        checked={correctIndex === idx}
                        onChange={() => setCorrectIndex(idx)}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      Correct Answer
                    </label>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    style={{
                      textAlign: 'left',
                      borderColor: correctIndex === idx ? 'var(--primary)' : 'var(--border-color)',
                      borderWidth: correctIndex === idx ? '2px' : '1px'
                    }}
                    value={option}
                    onChange={e => handleOptionChange(idx, e.target.value)}
                    placeholder={`Enter Option ${idx + 1}...`}
                    required
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={resetForm} disabled={loading}>
                <X size={18} /> Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                <Save size={18} /> {loading ? 'Saving...' : 'Save Question'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {loading && <div style={{ textAlign: 'center', padding: '2rem' }}>Loading questions...</div>}
          {!loading && questions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              No questions found. Click "New Question" to add one, or run the schema seeding SQL in Supabase.
            </div>
          )}
          {questions.map((q, idx) => (
            <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ flex: 1, paddingRight: '2rem' }}>
                <h4 style={{ fontSize: '1.2rem', marginTop: '0.25rem', marginBottom: '0.75rem', fontWeight: 700, color: 'var(--primary-dark)' }}>
                  {idx + 1}. {q.question_text}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {q.options.map((opt, oIdx) => (
                    <div
                      key={oIdx}
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.9rem',
                        backgroundColor: oIdx === q.correct_index ? 'rgba(11, 102, 35, 0.08)' : 'var(--bg-card)',
                        border: oIdx === q.correct_index ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: oIdx === q.correct_index ? 'var(--primary-dark)' : 'var(--text-secondary)'
                      }}
                    >
                      <span style={{ fontWeight: 800, marginRight: '0.5rem', color: oIdx === q.correct_index ? 'var(--primary)' : 'var(--text-muted)' }}>
                        {oIdx === 0 ? '▲' : oIdx === 1 ? '◆' : oIdx === 2 ? '●' : '■'}
                      </span>
                      {opt}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-secondary" onClick={() => handleEdit(q)} style={{ padding: '0.5rem' }}>
                  <Edit3 size={16} />
                </button>
                <button className="btn btn-secondary" onClick={() => handleDelete(q.id)} style={{ padding: '0.5rem', color: 'var(--color-red)' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
