import React, { useState, useEffect } from 'react';
import Together from 'together-ai';
import ClipLoader from 'react-spinners/ClipLoader';
import './App.css';

const App = () => {
  const [abstract, setAbstract] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [tokenCount, setTokenCount] = useState(0);
  const [submissionCount, setSubmissionCount] = useState(0);

  const MAX_DAILY_SUBMISSIONS = 10;
  const MAX_MONTHLY_COST = 15; // $15
  const COST_PER_MILLION_TOKENS = 0.88; // $0.88 per million tokens
  const MAX_MONTHLY_TOKENS = (MAX_MONTHLY_COST / COST_PER_MILLION_TOKENS) * 1_000_000; // Convert to tokens

  const apiKey = process.env.REACT_APP_TOGETHER_API_KEY;

  if (!apiKey) {
    console.error('API key is missing. Please set REACT_APP_TOGETHER_API_KEY in your .env file.');
    setError('API key is missing. Please set REACT_APP_TOGETHER_API_KEY in your .env file.');
  }

  const together = new Together({ apiKey });

  useEffect(() => {
    const storedTokenCount = parseInt(localStorage.getItem('tokenCount'), 10) || 0;
    const storedSubmissionCount = parseInt(localStorage.getItem('submissionCount'), 10) || 0;
    const lastReset = localStorage.getItem('lastReset');
    const today = new Date().toDateString();

    if (lastReset !== today) {
      setSubmissionCount(0);
      localStorage.setItem('submissionCount', 0);
      localStorage.setItem('lastReset', today);
    } else {
      setSubmissionCount(storedSubmissionCount);
    }

    setTokenCount(storedTokenCount);
  }, []);

  const handleAbstractChange = (event) => {
    setAbstract(event.target.value);
  };

  const handleTemperatureChange = (event) => {
    setTemperature(parseFloat(event.target.value));
  };

  const handleSubmit = async () => {
    if (submissionCount >= MAX_DAILY_SUBMISSIONS) {
      setError('You have reached the maximum number of submissions for today.');
      return;
    }

    if (tokenCount >= MAX_MONTHLY_TOKENS) {
      setError('Monthly token limit reached. Please try again next month.');
      return;
    }

    setLoading(true);
    try {
      const res = await together.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are Reviewer #2, known for giving harsh and rude feedback.' },
          { role: 'user', content: abstract }
        ],
        model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        temperature: temperature,
      });

      const responseText = res.choices[0].message.content;
      const tokensUsed = responseText.split(' ').length; // Estimate token count

      setResponse(responseText);
      setTokenCount(prev => {
        const newTokenCount = prev + tokensUsed;
        localStorage.setItem('tokenCount', newTokenCount);
        return newTokenCount;
      });

      setSubmissionCount(prev => {
        const newSubmissionCount = prev + 1;
        localStorage.setItem('submissionCount', newSubmissionCount);
        return newSubmissionCount;
      });

      setError('');
    } catch (err) {
      console.error('Error fetching response:', err);
      setError('There was an error processing your request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Submit Your Abstract</h1>
      <textarea
        value={abstract}
        onChange={handleAbstractChange}
        placeholder="Enter your abstract here"
        rows="10"
        cols="50"
      />
      <label htmlFor="temperature">Temperature: {temperature}</label>
      <input
        id="temperature"
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={temperature}
        onChange={handleTemperatureChange}
      />
      <button onClick={handleSubmit} disabled={loading}>Submit Abstract</button>
      {loading && (
        <div className="spinner-container">
          <ClipLoader color="#007bff" />
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <div className="response">
        <h2>Response from Reviewer #2</h2>
        <p>{response}</p>
      </div>
    </div>
  );
};

export default App;
