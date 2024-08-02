import React, { useState, useEffect } from 'react';
import Together from 'together-ai';
import ClipLoader from 'react-spinners/ClipLoader';
import './App.css';

const App = () => {
  const [abstract, setAbstract] = useState('');
  const [messages, setMessages] = useState([
    { role: 'system', content: '' }
  ]);
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

  useEffect(() => {
    const initialMessage = 'Reviewer #2: Ugh, fine, show me your abstract.';
    typeMessage(initialMessage, 'system');
  }, []);

  const typeMessage = (message, role) => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < message.length) {
        setMessages(prev => {
          const newMessages = [...prev];
          const currentMessage = newMessages[newMessages.length - 1];
          currentMessage.content = message.slice(0, index + 1);
          return newMessages;
        });
        index++;
      } else {
        clearInterval(interval);
      }
    }, 50); // Typing speed
  };

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
      setMessages(prev => [
        ...prev,
        { role: 'user', content: abstract }
      ]);
      const res = await together.chat.completions.create({
        messages: [
          ...messages,
          { role: 'user', content: abstract }
        ],
        model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        temperature: temperature,
      });

      const responseText = res.choices[0].message.content;
      const tokensUsed = responseText.split(' ').length; // Estimate token count

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
      typeMessage(responseText, 'system');
    } catch (err) {
      console.error('Error fetching response:', err);
      setError('There was an error processing your request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Chat with Reviewer #2</h1>
      <div className="chat-window">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.role}`}>
            <p>{message.content}</p>
          </div>
        ))}
        <div className="input-line">
          <span className="cursor">> </span>
          <textarea
            value={abstract}
            onChange={handleAbstractChange}
            placeholder="Enter your abstract here"
            rows="1"
            cols="50"
          />
        </div>
      </div>
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
      <button onClick={handleSubmit} disabled={loading || !abstract.trim()}>Submit Abstract</button>
      {loading && (
        <div className="spinner-container">
          <ClipLoader color="#007bff" />
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
};

export default App;
