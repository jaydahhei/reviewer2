import React, { useState, useEffect, useRef } from 'react';
import Together from 'together-ai';
import ClipLoader from 'react-spinners/ClipLoader';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';
import './App.css';
import reviewer2 from './reviewer2.png';

const App = () => {
  const [editorDecisionMade, setEditorDecisionMade] = useState(false);
  const [abstract, setAbstract] = useState('');
  const [messages, setMessages] = useState([
    { role: 'system', content: 'Reviewer #2: Ugh, fine, show me your abstract.' }
  ]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [tokenCount, setTokenCount] = useState(0);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [showInput, setShowInput] = useState(true);
  const [isRebuttal, setIsRebuttal] = useState(false);
  const [triesLeft, setTriesLeft] = useState(3);
  const [showSettings, setShowSettings] = useState(false);
  const chatWindowRef = useRef(null);

  const MAX_MONTHLY_COST = 15; // $15
  const COST_PER_MILLION_TOKENS = 0.88; // $0.88 per million tokens
  const MAX_MONTHLY_TOKENS = (MAX_MONTHLY_COST / COST_PER_MILLION_TOKENS) * 1_000_000; // Convert to tokens
  const MAX_TOKENS_PER_RESPONSE = 300; // Increased limit for longer responses
  const MAX_TOKENS_PER_INPUT = 500; // Limit the user input to 500 tokens

  const apiKey = process.env.REACT_APP_TOGETHER_API_KEY;

  if (!apiKey) {
    console.error('API key is missing. Please set REACT_APP_TOGETHER_API_KEY in your .env file.');
  }

  const together = new Together({ apiKey });

  useEffect(() => {
    const storedTokenCount = parseInt(localStorage.getItem('tokenCount'), 10) || 0;
    const storedSubmissionCount = parseInt(localStorage.getItem('submissionCount'), 10) || 0;
    const storedAcceptedCount = parseInt(localStorage.getItem('acceptedCount'), 10) || 0;
    const storedRejectedCount = parseInt(localStorage.getItem('rejectedCount'), 10) || 0;
    const lastReset = localStorage.getItem('lastReset');
    const today = new Date().toDateString();

    if (lastReset !== today) {
      setSubmissionCount(0);
      setAcceptedCount(0);
      setRejectedCount(0);
      localStorage.setItem('submissionCount', 0);
      localStorage.setItem('acceptedCount', 0);
      localStorage.setItem('rejectedCount', 0);
      localStorage.setItem('lastReset', today);
    } else {
      setSubmissionCount(storedSubmissionCount);
      setAcceptedCount(storedAcceptedCount);
      setRejectedCount(storedRejectedCount);
    }

    setTokenCount(storedTokenCount);
  }, []);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [messages]);

  const typeMessage = (message, role, callback) => {
    setMessages(prev => {
      const newMessages = [...prev, { role, content: message }];
      return newMessages;
    });
    if (callback) callback();
  };

  const handleAbstractChange = (event) => {
    setAbstract(event.target.value);
  };

  const handleTemperatureChange = (event) => {
    setTemperature(parseFloat(event.target.value));
  };

  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  const calculateTokens = (text) => {
    // Simple token calculation: split by spaces and count the words
    return text.split(/\s+/).length;
  };

  const handleSubmit = async () => {
    const tokenCountForInput = calculateTokens(abstract);
    if (tokenCountForInput > MAX_TOKENS_PER_INPUT) {
      setError(`Input exceeds the maximum allowed length of ${MAX_TOKENS_PER_INPUT} tokens.`);
      return;
    }

    if (tokenCount >= MAX_MONTHLY_TOKENS) {
      setError('Monthly token limit reached. Please try again next month.');
      return;
    }

    setLoading(true);
    setShowInput(false);
    try {
      const internalPrompt = { role: 'system', content: 'You are Reviewer #2, known for giving harsh and rude feedback. You are also known for being exceptionally critical and demanding. You are an angry and bitter scholar exacting revenge on your peers through overly critical anonymous rejections of papers you secretly wish you would have written. Keep your response under 1000 tokens.' };

      const newMessages = [
        ...(isRebuttal ? messages : [internalPrompt, ...messages]),
        { role: 'user', content: abstract }
      ];
      
      // Filter out the internal prompt for display purposes
      const displayMessages = [
        ...(isRebuttal ? messages : [...messages]),
        { role: 'user', content: abstract }
      ];

      setMessages(displayMessages);
      setAbstract('');

      const model = isRebuttal ? 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo' : 'meta-llama/Meta-Llama-3-8B-Instruct-Lite';
      const res = await together.chat.completions.create({
        messages: newMessages,
        model: model,
        temperature: temperature,
        max_tokens: MAX_TOKENS_PER_RESPONSE,
      });

      const responseText = res.choices[0]?.message?.content || "No response from reviewer";
      const tokensUsed = responseText.split(' ').length;

      setTokenCount(prev => {
        const newTokenCount = prev + tokensUsed;
        localStorage.setItem('tokenCount', newTokenCount);
        return newTokenCount;
      });

      if (!isRebuttal) {
        setSubmissionCount(prev => {
          const newSubmissionCount = prev + 1;
          localStorage.setItem('submissionCount', newSubmissionCount);
          return newSubmissionCount;
        });
        setIsRebuttal(true); // Start rebuttal process
      }

      setError('');
      typeMessage(responseText, 'system', () => {
        if (isRebuttal) {
          handleEditorDecision(newMessages);
        } else {
          setShowInput(true);
        }
      });
    } catch (err) {
      console.error('Error fetching response:', err);
      setError('There was an error processing your request.');
      setShowInput(true);
    } finally {
      setLoading(false);
    }
  };

  const handleEditorDecision = async (newMessages) => {
    if (editorDecisionMade) return;

    setLoading(true);
    try {
      const userMessages = newMessages.filter(m => m.role === 'user');
      const systemMessages = newMessages.filter(m => m.role === 'system');
      const abstract = userMessages[0]?.content || 'N/A';
      const review = systemMessages.find(m => m.content.startsWith('Reviewer'))?.content || 'N/A';
      const rebuttal = userMessages[userMessages.length - 1]?.content || 'N/A';

      const editorPrompt = `As the Editor, evaluate whether the author's abstract should be published based on the following information: the author's original abstract, the reviewer's comments on the abstract, and the author's rebuttal to those comments. Please make your decision considering the merits of the abstract itself, and how well the rebuttal addresses the reviewer's critiques. Also, this is a prestigious journal, so remember to be very selective and be more inclined to reject rather than accept any abstract. You also know the Reviewer #2 personally and are likely to listen to their opinion, but make sure you don't mention this conflict of interest in your explanation since it's not allowed. Feel free to accept an abstract if you really feel compelled to for an outstanding abstract and/or rebuttal. Keep your response concise and do not go over 300 tokens. Respond with either "ACCEPT" or "REJECT" followed by a brief explanation.\n\nAbstract: ${abstract}\nReview: ${review}\nRebuttal: ${rebuttal}`;

      const res = await together.chat.completions.create({
        messages: [
          { role: 'user', content: editorPrompt }
        ],
        model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        temperature: temperature,
        max_tokens: MAX_TOKENS_PER_RESPONSE,
      });

      if (!res.choices || res.choices.length === 0) {
        throw new Error('No choices in the API response');
      }

      const decision = res.choices[0]?.message?.content;
      if (!decision) {
        throw new Error('No content in the API response');
      }

      console.log('Editor decision:', decision);
      const isAccepted = decision.toLowerCase().includes('accept');

      if (isAccepted) {
        setAcceptedCount(prev => {
          const newCount = prev + 1;
          localStorage.setItem('acceptedCount', newCount);
          return newCount;
        });
      } else {
        setRejectedCount(prev => {
          const newCount = prev + 1;
          localStorage.setItem('rejectedCount', newCount);
          return newCount;
        });
      }

      typeMessage(`Editor: ${decision}`, 'system');
      setEditorDecisionMade(true);
    } catch (err) {
      console.error('Error fetching editor decision:', err);
      setError(`There was an error getting the editor's decision: ${err.message}`);
    } finally {
      setLoading(false);
      setShowInput(false);
      setIsRebuttal(false);
      setTriesLeft(prev => prev - 1); // Decrement tries left
    }
  };

  return (
    <div className="app-container">
      <div className="settings-container">
        <FontAwesomeIcon icon={faCog} size="2x" onClick={toggleSettings} />
        {showSettings && (
          <div className="temperature-setting">
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
          </div>
        )}
      </div>
      <h1>Chat with Reviewer #2</h1>
      <div className="reviewer-container">
        <img src={reviewer2} alt="Reviewer 2" className="reviewer-image" />
        <div className="chat-window" ref={chatWindowRef}>
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              <p>{message.content}</p>
            </div>
          ))}
          {showInput && (
            <div className="input-line">
              <span className="cursor">> </span>
              <textarea
                value={abstract}
                onChange={handleAbstractChange}
                placeholder={isRebuttal ? "Enter your rebuttal here" : "Enter your abstract here"}
                rows="1"
                cols="50"
              />
            </div>
          )}
        </div>
      </div>
      {showInput && (
        <button onClick={handleSubmit} disabled={loading || !abstract.trim()}>
          {isRebuttal ? "Submit Rebuttal" : "Submit Abstract"}
        </button>
      )}
      {loading && (
        <div className="spinner-container">
          <ClipLoader color="#007bff" />
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <p className="disclaimer">Disclaimer: This application does not store any user data or submitted abstracts.</p>
      <div className="counter">
        <div>{submissionCount} Abstracts read</div>
        <div className="decision-counts">
          <div><ThumbsUp size={18} /> {acceptedCount}</div>
          <div><ThumbsDown size={18} /> {rejectedCount}</div>
        </div>
      </div>
    </div>
  );
};

export default App;
