import React, { useState, useRef, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import axios from 'axios';

// Rate limits configuration
const MAX_RETRIES = 5;
const RATE_LIMITS = {
  gpt: {
    requestsPerMinute: 10000,
    minDelay: 10,
    timeout: 120000  // 120 seconds
  },
  gemini: {
    requestsPerMinute: 60,
    minDelay: 2000,
    timeout: 60000   // 60 seconds
  },
  claude: {
    requestsPerMinute: 1000,
    inputTokensPerMinute: 80000,
    outputTokensPerMinute: 16000,
    minDelay: 60, // 60ms between requests (1000 requests per minute)
    timeout: 60000   // 60 seconds
  },
  perplexity: {
    requestsPerMinute: 50,
    minDelay: 2000,
    timeout: 60000   // 60 seconds
  }
};

const DEFAULT_MODEL_CONFIG = {
  gpt: {
    model: 'gpt4o-2024-06-06',
    token: 4000,
    systemPrompt: 'The output should read like an experienced friend guiding you through their favorite recipe, while maintaining clean, semantic HTML markup without any surrounding code block indicators.',
    active: false,
    visionModel: 'gpt-4-vision-preview',
    visionEnabled: false
  },
  gemini: {
    model: 'gemini-1.5-flash',
    token: 8092,
    systemPrompt: 'You are a helpful assistant.',
    active: true,
    visionModel: 'gemini-pro-vision',
    visionEnabled: false
  },
  claude: {
    model: 'claude-3-5-sonnet-20240620',
    token: 4050,
    systemPrompt: 'You are an expert in HTML.',
    active: false,
    visionModel: 'claude-3-opus-20240229',
    visionEnabled: false
  },
  perplexity: {
    model: 'llama-3.1-sonar-small-128k-online',
    token: 4050,
    systemPrompt: 'be precise and factually correct',
    active: false,
    visionEnabled: false
  }
};

// Add token counting utility function
const estimateTokens = (text) => {
  // Rough estimation: ~4 characters per token
  return Math.ceil(text.length / 4);
};

// Add these utility functions at the top of the component
const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

const formatCellContent = (content) => {
  if (!content) return '';
  if (typeof content !== 'string') return String(content);
  
  // Check if content is JSON
  try {
    const parsed = JSON.parse(content);
    return <pre className="json-content">{JSON.stringify(parsed, null, 2)}</pre>;
  } catch {
    // Not JSON, return normal text
    return truncateText(content);
  }
};

// Add error cell detection utility
const isErrorCell = (content) => {
  if (!content) return false;
  return typeof content === 'string' && content.toLowerCase().includes('error');
};

// Add this new component for the CSV preview
const CSVPreview = ({ data, columns }) => {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  
  // Reset page when data changes
  useEffect(() => {
    setPage(1);
  }, [data]);

  // Filter and sort data
  const filteredData = React.useMemo(() => {
    let filtered = [...data];
    
    if (searchTerm) {
      filtered = filtered.filter(row => 
        Object.values(row).some(value => 
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
    
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = String(a[sortConfig.key] || '').toLowerCase();
        const bValue = String(b[sortConfig.key] || '').toLowerCase();
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return filtered;
  }, [data, searchTerm, sortConfig]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const startIndex = (page - 1) * rowsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + rowsPerPage);

  const handleSort = (column) => {
    setSortConfig(current => ({
      key: column,
      direction: current.key === column && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  return (
    <div className="csv-preview">
      {/* Controls */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1rem',
        padding: '1rem',
        backgroundColor: '#f8fafc',
        borderRadius: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '0.5rem',
              borderRadius: '0.375rem',
              border: '1px solid #e2e8f0'
            }}
          />
          <select
            value={rowsPerPage}
            onChange={(e) => setRowsPerPage(Number(e.target.value))}
            style={{
              padding: '0.5rem',
              borderRadius: '0.375rem',
              border: '1px solid #e2e8f0'
            }}
          >
            <option value={10}>10 rows</option>
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </select>
        </div>
        <div style={{ color: '#4a5568' }}>
          Total: {filteredData.length} rows
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          backgroundColor: 'white',
          fontSize: '0.875rem'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f7fafc' }}>
              {columns.map(column => (
                <th
                  key={column}
                  onClick={() => handleSort(column)}
                  style={{ 
                    padding: '1rem',
                    textAlign: 'left',
                    borderBottom: '2px solid #e2e8f0',
                    cursor: 'pointer',
                    position: 'relative',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {column}
                    {sortConfig.key === column && (
                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                style={{ 
                  borderBottom: '1px solid #e2e8f0',
                  backgroundColor: rowIndex % 2 === 0 ? '#ffffff' : '#f7fafc'
                }}
              >
                {columns.map(column => (
                  <td
                    key={`${rowIndex}-${column}`}
                    style={{ 
                      padding: '1rem',
                      maxWidth: '300px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      backgroundColor: isErrorCell(row[column]) ? '#fff5f5' : 'inherit'
                    }}
                    title={row[column]} // Show full content on hover
                  >
                    {formatCellContent(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '1rem',
        padding: '1rem',
        backgroundColor: '#f8fafc',
        borderRadius: '0.5rem'
      }}>
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            border: '1px solid #e2e8f0',
            backgroundColor: page === 1 ? '#edf2f7' : '#ffffff',
            cursor: page === 1 ? 'not-allowed' : 'pointer'
          }}
        >
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            border: '1px solid #e2e8f0',
            backgroundColor: page === totalPages ? '#edf2f7' : '#ffffff',
            cursor: page === totalPages ? 'not-allowed' : 'pointer'
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Add these constants at the top with other constants
const CLAUDE_PRICING = {
  input: 0.000003,  // $3 per million tokens = $0.000003 per token
  output: 0.000015  // $15 per million tokens = $0.000015 per token
};

const CLAUDE_BATCH_SIZE = 1000; // Increased from 20 to 1000, can go up to 10000
const MAX_BATCH_SIZE_MB = 32; // Maximum batch size in MB

// Helper to estimate batch size in MB
const estimateBatchSizeMB = (messages) => {
  return new Blob([JSON.stringify(messages)]).size / (1024 * 1024);
};

// Helper to split messages into optimal batch sizes
const splitIntoBatches = (messages) => {
  const batches = [];
  let currentBatch = [];
  let currentBatchSize = 0;

  for (const msg of messages) {
    const msgSize = new Blob([JSON.stringify(msg)]).size / (1024 * 1024);
    
    // If adding this message would exceed size limit, start new batch
    if (currentBatchSize + msgSize > MAX_BATCH_SIZE_MB || currentBatch.length >= CLAUDE_BATCH_SIZE) {
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
      }
      currentBatch = [msg];
      currentBatchSize = msgSize;
    } else {
      currentBatch.push(msg);
      currentBatchSize += msgSize;
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
};

const AIProcessor = () => {
  const [csvData, setCsvData] = useState(null);
  const [columns, setColumns] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    currentRow: null
  });
  const [output, setOutput] = useState(null);
  const [error, setError] = useState(null);
  const [failedCells, setFailedCells] = useState([]);
  const [showFailedCells, setShowFailedCells] = useState(false);
  const stopProcessingRef = useRef(false);
  const abortController = useRef(null);

  // Add new state for prompt library
  const [promptLibrary, setPromptLibrary] = useState(() => {
    const savedLibrary = localStorage.getItem('promptLibrary');
    return savedLibrary ? JSON.parse(savedLibrary) : [];
  });

  // Add new state for tracking processed columns
  const [processedColumns, setProcessedColumns] = useState({});

  // Add new state for preview visibility
  const [showPreview, setShowPreview] = useState(false);

  // Add new state for editing
  const [editingPrompt, setEditingPrompt] = useState(null);

  // Add this state to the component
  const [tokenStats, setTokenStats] = useState({
    inputTokens: 0,
    outputTokens: 0,
    totalCost: 0
  });

  // Add state for batch jobs
  const [batchJobs, setBatchJobs] = useState([]);

  // Add state for selected model
  const [selectedModel, setSelectedModel] = useState(() => 
    localStorage.getItem('selectedModel') || 'claude'
  );

  // Add state for model configuration
  const [modelConfig, setModelConfig] = useState(() => {
    const savedConfig = localStorage.getItem('modelConfig');
    return savedConfig ? JSON.parse(savedConfig) : DEFAULT_MODEL_CONFIG;
  });

  // Handle storage errors
  useEffect(() => {
    const handleStorageError = (e) => {
      if (e.name === 'QuotaExceededError') {
        console.error('localStorage quota exceeded');
        setError('Unable to save settings: Storage quota exceeded');
      }
    };

    window.addEventListener('error', handleStorageError);
    return () => window.removeEventListener('error', handleStorageError);
  }, []);

  // Save model config when it changes
  useEffect(() => {
    localStorage.setItem('modelConfig', JSON.stringify(modelConfig));
  }, [modelConfig]);

  // Save selected model when it changes
  useEffect(() => {
    localStorage.setItem('selectedModel', selectedModel);
  }, [selectedModel]);

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const handleError = (error, context = '') => {
    console.error(`Error ${context}:`, error);
    const errorMessage = error.response?.data?.error || error.message || 'An unknown error occurred';
    setError(`${context}: ${errorMessage}`);
    return errorMessage;
  };
  const handleModelSelect = (model) => {
    setSelectedModel(model);
  };

  const updateModelConfig = (model, field, value) => {
    setModelConfig(prev => {
      const newConfig = {
        ...prev,
        [model]: {
          ...prev[model],
          [field]: value
        }
      };
      return newConfig;
    });
  };

  const resetToDefaults = () => {
    localStorage.removeItem('modelConfig');
    localStorage.removeItem('selectedModel');
    window.location.reload();
  };

  const trackFailedCell = (rowIndex, prompt, error) => {
    setFailedCells(prev => [...prev, {
      rowIndex,
      promptName: prompt.name,
      outputColumn: prompt.outputColumn,
      prompt,
      error: error.message || String(error)
    }]);
  };

  const reprocessFailedCells = async () => {
    if (!failedCells.length || !output) return;

    setProcessing(true);
    setError(null);
    const results = [...output];

    try {
      let tokenCount = 0;
      let lastMinuteStart = Date.now();

      const resetTokenCount = () => {
        tokenCount = 0;
        lastMinuteStart = Date.now();
      };

      const checkAndResetTokens = async () => {
        const now = Date.now();
        if (now - lastMinuteStart >= 60000) {
          resetTokenCount();
        } else if (tokenCount >= RATE_LIMITS[selectedModel]?.inputTokensPerMinute) {
          const waitTime = 60000 - (now - lastMinuteStart);
          await sleep(waitTime);
          resetTokenCount();
        }
      };

      setProgress({
        current: 0,
        total: failedCells.length,
        currentRow: 'Reprocessing failed cells'
      });

      for (let i = 0; i < failedCells.length && !stopProcessingRef.current; i++) {
        const failedCell = failedCells[i];
        
        if (selectedModel === 'claude') {
          await checkAndResetTokens();
        }

        try {
          const result = await processRow(
            results[failedCell.rowIndex],
            failedCell.prompt,
            0,
            failedCell.rowIndex
          );

          results[failedCell.rowIndex][failedCell.outputColumn] = result;
          
          // Update progress
          setProgress(prev => ({
            ...prev,
            current: i + 1,
            currentRow: `Reprocessing failed cell ${i + 1}/${failedCells.length}`
          }));

          // Update output after each successful reprocess
          setOutput([...results]);
        } catch (error) {
          console.error(`Failed to reprocess cell at row ${failedCell.rowIndex}:`, error);
          // Keep the failed cell in the list if it fails again
          continue;
        }
      }

      // Remove successfully reprocessed cells from failedCells
      setFailedCells(prev => 
        prev.filter(cell => 
          results[cell.rowIndex][cell.outputColumn].includes('Error')
        )
      );

    } catch (error) {
      if (error.message !== 'Processing stopped by user') {
        handleError(error, 'Reprocessing failed cells');
      }
    } finally {
      setProcessing(false);
      setProgress({ current: 0, total: 0, currentRow: null });
      stopProcessingRef.current = false;
      abortController.current = null;
    }

    if (results.length > 0) {
      setOutput(results);
      downloadResults();
    }
  };

  const ColumnHelper = ({ columns }) => {
    return (
      <div className="mt-2 text-sm text-gray-600">
        <div>Available columns: (Click to copy)</div>
        <div className="flex flex-wrap gap-2 mt-1">
          {columns.map(column => (
            <span
              key={column}
              className="px-2 py-1 bg-gray-100 rounded cursor-pointer hover:bg-gray-200"
              onClick={() => {
                navigator.clipboard.writeText(`{${column}}`);
              }}
            >
              {'{' + column + '}'}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          setCsvData(results.data);
          setColumns(results.meta.fields);
        }
      });
    }
  };

  const addPrompt = () => {
    setPrompts([...prompts, {
      id: Date.now(),
      name: `Prompt ${prompts.length + 1}`,
      template: '',
      outputColumn: '',
      visionEnabled: false,
      visionModel: '',
      active: true,
      dependencies: [] // Add this to track dependencies
    }]);
  };

  // Add this function to calculate costs
  const calculateCosts = (inputTokens, outputTokens) => {
    const inputCost = inputTokens * CLAUDE_PRICING.input;
    const outputCost = outputTokens * CLAUDE_PRICING.output;
    return {
      inputTokens,
      outputTokens,
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost
    };
  };

  // Update the processRow function to track tokens
  const processRow = async (row, prompt, retryCount = 0, rowIndex = null) => {
    try {
      if (stopProcessingRef.current) {
        throw new Error('Processing stopped by user');
      }

      // Process the prompt template and extract any URLs
      let processedPrompt = prompt.template;
      const urlMatches = [];
      
      processedPrompt = processedPrompt.replace(
        /\{([^}]+)\}/g,
        (match, columnName) => {
          const cleanColumnName = columnName.trim();
          // Check if this column is from a previous prompt's output
          if (processedColumns[cleanColumnName]) {
            // Use the processed output from the results array
            return row[cleanColumnName] || match;
          }
          // Otherwise use the original CSV data
          const value = row[cleanColumnName] || match;
          
          if (prompt.visionEnabled) {
            const urls = value
              .split(/[\n,;]/)
              .map(url => url.trim())
              .filter(url => url);
            
            const imageUrls = urls.filter(url => 
              url.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)/i)
            );
            
            urlMatches.push(...imageUrls);
          }
          return value;
        }
      );

      // Skip empty cells
      if (!processedPrompt || processedPrompt === prompt.template) {
        console.log('Skipping empty cell');
        return '';
      }

      let inputTokenCount = 0;
      if (selectedModel === 'claude') {
        inputTokenCount = estimateTokens(processedPrompt) + 
          estimateTokens(modelConfig.claude.systemPrompt);
        
        // Check if we're within rate limits
        if (inputTokenCount > RATE_LIMITS.claude.inputTokensPerMinute) {
          throw new Error('Input token limit exceeded for this request');
        }

        // Add delay based on requests per minute
        await sleep(RATE_LIMITS.claude.minDelay);
      } else {
        inputTokenCount = estimateTokens(processedPrompt);
      }

      abortController.current = new AbortController();

      // Process request
      const response = await axios.post(`${API_URL}/process`,
        {
          prompt: processedPrompt,
          model: selectedModel,
          modelConfig: {
            ...modelConfig[selectedModel],
            visionEnabled: prompt.visionEnabled,
            visionModel: prompt.visionModel || modelConfig[selectedModel].visionModel,
            imageUrls: prompt.visionEnabled ? urlMatches : []
          }
        },
        { 
          signal: abortController.current.signal,
          timeout: RATE_LIMITS[selectedModel].timeout
        }
      );

      const outputTokenCount = estimateTokens(response.data.result);

      // Update token stats
      setTokenStats(prev => {
        const newInputTokens = prev.inputTokens + inputTokenCount;
        const newOutputTokens = prev.outputTokens + outputTokenCount;
        const costs = calculateCosts(newInputTokens, newOutputTokens);
        return {
          inputTokens: newInputTokens,
          outputTokens: newOutputTokens,
          totalCost: costs.totalCost
        };
      });

      // Update the output state with the new result while preserving other columns
      if (rowIndex !== null) {
        setOutput(prevOutput => {
          const newOutput = [...prevOutput];
          newOutput[rowIndex] = {
            ...newOutput[rowIndex],
            [prompt.outputColumn]: response.data.result
          };
          return newOutput;
        });
      }

      return response.data.result || '';

    } catch (error) {
      if (error.message === 'Processing stopped by user') {
        throw error;
      }

      // Handle rate limit errors for Claude
      if (error.response?.status === 429) {
        if (retryCount < MAX_RETRIES) {
          const retryAfter = error.response.headers['retry-after'] || 60;
          console.log(`Rate limited by Claude API. Waiting ${retryAfter} seconds...`);
          await sleep(retryAfter * 1000);
          return processRow(row, prompt, retryCount + 1, rowIndex);
        }
      }

      // Handle other errors
      if (rowIndex !== null) {
        trackFailedCell(rowIndex, prompt, error);
      }
      throw error;
    }
  };

  // Batch process helper function
  const batchProcessRows = async (rows, prompt, startIndex) => {
    if (!rows.length) return [];
    
    try {
      // Prepare batch messages
      const batchMessages = rows.map(row => {
        let processedPrompt = prompt.template;
        const urlMatches = [];
        
        processedPrompt = processedPrompt.replace(
          /\{([^}]+)\}/g,
          (match, columnName) => {
            const cleanColumnName = columnName.trim();
            if (processedColumns[cleanColumnName]) {
              return row[cleanColumnName] || match;
            }
            const value = row[cleanColumnName] || match;
            
            if (prompt.visionEnabled) {
              const urls = value
                .split(/[\n,;]/)
                .map(url => url.trim())
                .filter(url => url);
              
              const imageUrls = urls.filter(url => 
                url.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)/i)
              );
              
              urlMatches.push(...imageUrls);
            }
            return value;
          }
        );

        return {
          content: processedPrompt,
          imageUrls: prompt.visionEnabled ? urlMatches : []
        };
      });

      // Skip if all prompts are empty
      if (batchMessages.every(msg => !msg.content || msg.content === prompt.template)) {
        console.log('Skipping empty batch');
        return new Array(rows.length).fill('');
      }

      // Create batch job
      const response = await axios.post(`${API_URL}/batch`, {
        messages: batchMessages,
        modelConfig: {
          ...modelConfig[selectedModel],
          visionEnabled: prompt.visionEnabled,
          visionModel: prompt.visionModel || modelConfig[selectedModel].visionModel
        }
      });

      // Add job to tracking list
      setBatchJobs(prev => [...prev, {
        ...response.data,
        outputColumn: prompt.outputColumn,
        startIndex
      }]);

      // Return empty array since results will come later
      return new Array(rows.length).fill('Processing...');
    } catch (error) {
      console.error('Batch processing error:', error);
      throw error;
    }
  };

  // Add batch job polling interval
  useEffect(() => {
    const pollInterval = setInterval(() => {
      batchJobs.forEach(async job => {
        if (job.status !== 'completed' && job.status !== 'failed') {
          try {
            const response = await axios.get(`${API_URL}/batch/${job.jobId}`);
            setBatchJobs(prev => prev.map(j => 
              j.jobId === job.jobId ? { ...j, ...response.data } : j
            ));

            // If job is completed, fetch results
            if (response.data.status === 'completed') {
              const resultsResponse = await axios.get(`${API_URL}/batch/${job.jobId}/results`);
              handleBatchResults(job.jobId, resultsResponse.data.results);
            }
          } catch (error) {
            console.error(`Error polling job ${job.jobId}:`, error);
          }
        }
      });
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [batchJobs]);

  // Handle batch results
  const handleBatchResults = (jobId, results) => {
    const job = batchJobs.find(j => j.jobId === jobId);
    if (!job) return;

    setOutput(prevOutput => {
      const newOutput = [...prevOutput];
      results.forEach((result, index) => {
        if (index < newOutput.length) {
          newOutput[index] = {
            ...newOutput[index],
            [job.outputColumn]: result
          };
        }
      });
      return newOutput;
    });
  };

  // Update the processData function
  const processData = async () => {
    if (!output || !csvData) return;

    setProcessing(true);
    setError(null);
    setFailedCells([]);
    stopProcessingRef.current = false;

    const results = [...output];
    const activePrompts = prompts.filter(p => p.active);
    const BATCH_SIZE = 20; // Maximum batch size for Claude API

    try {
      for (const prompt of activePrompts) {
        if (stopProcessingRef.current) break;

        setProgress({
          current: 0,
          total: results.length,
          currentRow: `Processing ${prompt.name}`
        });

        // Process in batches for Claude
        if (selectedModel === 'claude') {
          for (let i = 0; i < results.length; i += CLAUDE_BATCH_SIZE) {
            if (stopProcessingRef.current) break;

            const batchRows = results.slice(i, i + CLAUDE_BATCH_SIZE);
            try {
              const batchResults = await batchProcessRows(batchRows, prompt, i);
              
              // Update results with batch responses
              batchResults.forEach((result, index) => {
                const rowIndex = i + index;
                if (rowIndex < results.length) {
                  results[rowIndex][prompt.outputColumn] = result;
                }
              });
              
              setProgress(prev => ({
                ...prev,
                current: Math.min(i + CLAUDE_BATCH_SIZE, results.length)
              }));

              // Update output after each batch
              setOutput([...results]);
            } catch (error) {
              if (error.message === 'Processing stopped by user') {
                throw error;
              }
              console.error(`Error processing batch starting at row ${i}:`, error);
              batchRows.forEach((_, index) => {
                trackFailedCell(i + index, prompt, error);
              });
            }
          }
        } else {
          // Existing single-row processing for other models
          for (let i = 0; i < results.length; i++) {
            if (stopProcessingRef.current) break;

            try {
              const result = await processRow(results[i], prompt, 0, i);
              results[i][prompt.outputColumn] = result;
              
              setProgress(prev => ({
                ...prev,
                current: i + 1
              }));
            } catch (error) {
              if (error.message === 'Processing stopped by user') {
                throw error;
              }
              console.error(`Error processing row ${i}:`, error);
              trackFailedCell(i, prompt, error);
            }
          }
        }
      }
    } catch (error) {
      if (error.message !== 'Processing stopped by user') {
        handleError(error, 'Processing data');
      }
    } finally {
      setProcessing(false);
      setProgress({ current: 0, total: 0, currentRow: null });
      stopProcessingRef.current = false;
      abortController.current = null;
    }

    if (results.length > 0) {
      setOutput(results);
      downloadResults();
    }
  };

  const downloadResults = () => {
    if (!output || output.length === 0) return;
    const csv = Papa.unparse(output);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `processed_recipes_${timestamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const stopProcessing = () => {
    stopProcessingRef.current = true;
    if (abortController.current) {
      abortController.current.abort();
    }
  };

  // Add function to save prompt to library
  const saveToLibrary = (prompt) => {
    const newLibrary = [...promptLibrary, {
      ...prompt,
      id: Date.now(), // New ID for library entry
      savedAt: new Date().toISOString()
    }];
    setPromptLibrary(newLibrary);
    localStorage.setItem('promptLibrary', JSON.stringify(newLibrary));
  };

  // Add function to load prompt from library
  const loadFromLibrary = (libraryPrompt) => {
    setPrompts(prev => [...prev, {
      ...libraryPrompt,
      id: Date.now(), // New ID for the loaded prompt
      outputColumn: '', // Reset output column as it might be different
    }]);
  };

  // Add function to delete prompt from library
  const deleteFromLibrary = (promptId) => {
    const newLibrary = promptLibrary.filter(p => p.id !== promptId);
    setPromptLibrary(newLibrary);
    localStorage.setItem('promptLibrary', JSON.stringify(newLibrary));
  };

  // Add function to delete prompt
  const deletePrompt = (index) => {
    const newPrompts = prompts.filter((_, i) => i !== index);
    setPrompts(newPrompts);
  };

  // Update the prompt template input to detect dependencies
  const renderPromptTemplate = (prompt, index) => (
    <textarea
      placeholder="Enter your prompt template using {columnName} for dynamic values"
      value={prompt.template}
      onChange={(e) => {
        const newPrompts = [...prompts];
        newPrompts[index].template = e.target.value;
        setPrompts(newPrompts);
      }}
      style={{ 
        width: '100%',
        padding: '8px',
        border: '1px solid #e2e8f0',
        borderRadius: '4px',
        height: '200px',
        marginBottom: '10px',
        resize: 'vertical'
      }}
    />
  );

  // Add function to clear preview data
  const clearPreview = () => {
    setOutput(null);
    setShowPreview(false);
    resetTokenStats(); // Reset token stats when clearing preview
  };

  // Add function to start editing
  const startEditing = (prompt, index) => {
    setEditingPrompt({
      ...prompt,
      index
    });
  };

  // Add function to save edited prompt
  const saveEditedPrompt = () => {
    if (!editingPrompt) return;
    
    const newPrompts = [...prompts];
    newPrompts[editingPrompt.index] = {
      ...editingPrompt,
      id: prompts[editingPrompt.index].id // Preserve original ID
    };
    setPrompts(newPrompts);
    setEditingPrompt(null);
  };

  // Add function to cancel editing
  const cancelEditing = () => {
    setEditingPrompt(null);
  };

  // Add Edit Dialog Component
  const EditPromptDialog = ({ prompt, onSave, onCancel }) => {
    const [editedPrompt, setEditedPrompt] = useState(prompt);

    const handleSave = () => {
      onSave(editedPrompt);
    };

    return (
      <dialog
        open
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          border: 'none',
          borderRadius: '8px',
          padding: '20px',
          maxWidth: '800px',
          width: '90%',
          backgroundColor: '#ffffff',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          zIndex: 1000
        }}
      >
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: 0, color: '#2d3748' }}>Edit Prompt</h3>
          <button
            onClick={onCancel}
            style={{
              padding: '4px 8px',
              backgroundColor: '#e2e8f0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'grid', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#4a5568' }}>
              Prompt Name
            </label>
            <input
              type="text"
              value={editedPrompt.name}
              onChange={(e) => setEditedPrompt({ ...editedPrompt, name: e.target.value })}
              style={{ 
                width: '100%',
                padding: '8px',
                border: '1px solid #e2e8f0',
                borderRadius: '4px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#4a5568' }}>
              Output Column
            </label>
            <input
              type="text"
              value={editedPrompt.outputColumn}
              onChange={(e) => setEditedPrompt({ ...editedPrompt, outputColumn: e.target.value })}
              style={{ 
                width: '100%',
                padding: '8px',
                border: '1px solid #e2e8f0',
                borderRadius: '4px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#4a5568' }}>
              Prompt Template
            </label>
            <textarea
              value={editedPrompt.template}
              onChange={(e) => setEditedPrompt({ ...editedPrompt, template: e.target.value })}
              style={{ 
                width: '100%',
                padding: '8px',
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
                height: '200px',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px',
            backgroundColor: '#f7fafc',
            borderRadius: '4px'
          }}>
            <input
              type="checkbox"
              checked={editedPrompt.visionEnabled}
              onChange={(e) => setEditedPrompt({ ...editedPrompt, visionEnabled: e.target.checked })}
              id="vision-enabled"
            />
            <label htmlFor="vision-enabled">Enable Vision Analysis</label>
          </div>

          {editedPrompt.visionEnabled && (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', color: '#4a5568' }}>
                Vision Model
              </label>
              <input
                type="text"
                value={editedPrompt.visionModel}
                onChange={(e) => setEditedPrompt({ ...editedPrompt, visionModel: e.target.value })}
                style={{ 
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px'
                }}
              />
            </div>
          )}
        </div>

        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '10px',
          marginTop: '20px'
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              backgroundColor: '#e2e8f0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(editedPrompt)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#48bb78',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Save Changes
          </button>
        </div>
      </dialog>
    );
  };

  // Add this component for displaying token stats
  const TokenStats = ({ stats }) => {
    const formatNumber = (num) => {
      return new Intl.NumberFormat().format(Math.round(num));
    };

    const formatCost = (cost) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 4
      }).format(cost);
    };

    return (
      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#f8fafc',
        borderRadius: '6px',
        border: '1px solid #e2e8f0'
      }}>
        <h3 style={{ 
          fontSize: '1.1rem', 
          fontWeight: '600', 
          color: '#2d3748',
          marginBottom: '10px'
        }}>
          Claude Usage Statistics
        </h3>
        <div style={{ display: 'grid', gap: '10px' }}>
          <div>
            <span style={{ color: '#4a5568' }}>Input Tokens:</span>
            <span style={{ marginLeft: '10px', fontWeight: '500' }}>
              {formatNumber(stats.inputTokens)}
            </span>
            <span style={{ marginLeft: '10px', color: '#718096' }}>
              ({formatCost(stats.inputTokens * CLAUDE_PRICING.input)})
            </span>
          </div>
          <div>
            <span style={{ color: '#4a5568' }}>Output Tokens:</span>
            <span style={{ marginLeft: '10px', fontWeight: '500' }}>
              {formatNumber(stats.outputTokens)}
            </span>
            <span style={{ marginLeft: '10px', color: '#718096' }}>
              ({formatCost(stats.outputTokens * CLAUDE_PRICING.output)})
            </span>
          </div>
          <div style={{ 
            marginTop: '5px', 
            paddingTop: '10px', 
            borderTop: '1px solid #e2e8f0'
          }}>
            <span style={{ color: '#4a5568', fontWeight: '600' }}>Total Cost:</span>
            <span style={{ 
              marginLeft: '10px', 
              fontWeight: '600',
              color: '#2d3748'
            }}>
              {formatCost(stats.totalCost)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Add reset function for token stats
  const resetTokenStats = () => {
    setTokenStats({
      inputTokens: 0,
      outputTokens: 0,
      totalCost: 0
    });
  };

  return (
    <div style={{ 
      padding: '40px 20px',
      width: '100%',
      maxWidth: '1200px',
      margin: '0 auto',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      {/* Header Section */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '30px',
        padding: '0 0 20px',
        borderBottom: '1px solid #eee'
      }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2d3748' }}>AI Recipe Processor</h1>
        <button
          onClick={resetToDefaults}
          style={{
            padding: '8px 16px',
            backgroundColor: '#718096',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={e => e.target.style.backgroundColor = '#4a5568'}
          onMouseOut={e => e.target.style.backgroundColor = '#718096'}
        >
          Reset to Defaults
        </button>
      </div>

      {/* File Upload Section */}
      <div style={{ 
        marginBottom: '30px',
        padding: '20px',
        backgroundColor: '#f7fafc',
        borderRadius: '6px',
        border: '1px dashed #cbd5e0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '1.1rem', color: '#4a5568' }}>📤 Upload CSV</span>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            style={{ flex: 1 }}
          />
        </div>
        {csvData && (
          <div style={{ 
            marginTop: '10px', 
            color: '#718096',
            fontSize: '0.9rem' 
          }}>
            {csvData.length} rows loaded • {columns.join(', ')}
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '12px', 
          backgroundColor: '#fff5f5', 
          border: '1px solid #fc8181',
          borderRadius: '6px',
          color: '#c53030' 
        }}>
          {error}
        </div>
      )}

      {/* Model Selection */}
      <div style={{ 
        marginBottom: '30px',
        padding: '20px',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        gap: '15px'
      }}>
        <h2 style={{ 
          fontSize: '1.2rem', 
          fontWeight: '600', 
          color: '#1a202c'
        }}>
          Active Model:
        </h2>
        <select
          value={selectedModel}
          onChange={(e) => handleModelSelect(e.target.value)}
          style={{ 
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #cbd5e0',
            backgroundColor: '#fff',
            cursor: 'pointer',
            color: '#2d3748',
            fontWeight: '500',
            minWidth: '120px'
          }}
        >
          <option value="gpt">GPT</option>
          <option value="gemini">Gemini</option>
          <option value="claude">Claude</option>
          <option value="perplexity">Perplexity</option>
        </select>
      </div>

      {/* Prompts Section */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px' 
        }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#2d3748' }}>Prompts</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => {
                const promptLibraryDialog = document.getElementById('promptLibraryDialog');
                promptLibraryDialog.showModal();
              }}
              style={{ 
                padding: '8px 16px',
                backgroundColor: '#4299e1',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={e => e.target.style.backgroundColor = '#3182ce'}
              onMouseOut={e => e.target.style.backgroundColor = '#4299e1'}
            >
              Prompt Library
            </button>
            <button
              onClick={addPrompt}
              style={{ 
                padding: '8px 16px',
                backgroundColor: '#48bb78',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={e => e.target.style.backgroundColor = '#38a169'}
              onMouseOut={e => e.target.style.backgroundColor = '#48bb78'}
            >
              + Add Prompt
            </button>
          </div>
        </div>

        {/* Prompt Library Dialog */}
        <dialog
          id="promptLibraryDialog"
          style={{
            border: 'none',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '800px',
            width: '90%',
            backgroundColor: '#ffffff',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h3 style={{ margin: 0, color: '#2d3748' }}>Prompt Library</h3>
            <button
              onClick={() => document.getElementById('promptLibraryDialog').close()}
              style={{
                padding: '4px 8px',
                backgroundColor: '#e2e8f0',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {promptLibrary.map((libraryPrompt) => (
              <div
                key={libraryPrompt.id}
                style={{
                  padding: '15px',
                  backgroundColor: '#f7fafc',
                  borderRadius: '6px',
                  marginBottom: '10px',
                  border: '1px solid #e2e8f0'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '10px'
                }}>
                  <h4 style={{ margin: 0, color: '#2d3748' }}>{libraryPrompt.name}</h4>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => {
                        loadFromLibrary(libraryPrompt);
                        document.getElementById('promptLibraryDialog').close();
                      }}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#48bb78',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Load
                    </button>
                    <button
                      onClick={() => deleteFromLibrary(libraryPrompt.id)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#f56565',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div style={{ 
                  fontSize: '0.9rem',
                  color: '#4a5568',
                  whiteSpace: 'pre-wrap'
                }}>
                  {libraryPrompt.template}
                </div>
              </div>
            ))}
            {promptLibrary.length === 0 && (
              <div style={{ textAlign: 'center', color: '#718096', padding: '20px' }}>
                No saved prompts yet
              </div>
            )}
          </div>
        </dialog>

        <div style={{ display: 'grid', gap: '20px' }}>
          {prompts.map((prompt, index) => (
            <div key={prompt.id} style={{ 
              padding: '20px',
              backgroundColor: '#f7fafc',
              borderRadius: '6px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr auto', 
                gap: '15px', 
                marginBottom: '15px',
                alignItems: 'center'
              }}>
                <input
                  type="text"
                  placeholder="Prompt Name"
                  value={prompt.name}
                  onChange={(e) => {
                    const newPrompts = [...prompts];
                    newPrompts[index].name = e.target.value;
                    setPrompts(newPrompts);
                  }}
                  style={{ padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                />
                <input
                  type="text"
                  placeholder="Output Column"
                  value={prompt.outputColumn}
                  onChange={(e) => {
                    const newPrompts = [...prompts];
                    newPrompts[index].outputColumn = e.target.value;
                    setPrompts(newPrompts);
                  }}
                  style={{ padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => startEditing(prompt, index)}
                    style={{
                      padding: '8px',
                      backgroundColor: '#4299e1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                    title="Edit Prompt"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => saveToLibrary(prompt)}
                    style={{
                      padding: '8px',
                      backgroundColor: '#4299e1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                    title="Save to Library"
                  >
                    💾
                  </button>
                  <button
                    onClick={() => deletePrompt(index)}
                    style={{
                      padding: '8px',
                      backgroundColor: '#f56565',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                    title="Delete Prompt"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              
              <div style={{ 
                marginBottom: '15px',
                padding: '10px',
                backgroundColor: '#edf2f7',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '15px'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={prompt.visionEnabled}
                    onChange={(e) => {
                      const newPrompts = [...prompts];
                      newPrompts[index].visionEnabled = e.target.checked;
                      setPrompts(newPrompts);
                    }}
                  />
                  <span>Enable Vision Capability</span>
                </label>
                {prompt.visionEnabled && (
                  <input
                    type="text"
                    value={prompt.visionModel}
                    onChange={(e) => {
                      const newPrompts = [...prompts];
                      newPrompts[index].visionModel = e.target.value;
                      setPrompts(newPrompts);
                    }}
                    placeholder={`Enter ${selectedModel} vision model name`}
                    style={{ 
                      flex: 1,
                      padding: '8px', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '4px' 
                    }}
                  />
                )}
              </div>
              
              {renderPromptTemplate(prompt, index)}
              {columns.length > 0 && <ColumnHelper columns={columns} />}
            </div>
          ))}
        </div>
      </div>

      {/* Processing Status */}
      {processing && (
        <div style={{ 
          marginTop: '30px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          backgroundColor: '#f7fafc'
        }}>
          <div style={{ 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '15px'
          }}>
            <div>Processing Recipe {progress.current} of {progress.total}</div>
            <button
              onClick={stopProcessing}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f56565',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={e => e.target.style.backgroundColor = '#e53e3e'}
              onMouseOut={e => e.target.style.backgroundColor = '#f56565'}
            >
              Stop Processing
            </button>
          </div>
          <div style={{ 
            height: '8px',
            backgroundColor: '#edf2f7',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div
              style={{
                width: `${(progress.current / progress.total) * 100}%`,
                height: '100%',
                backgroundColor: '#48bb78',
                transition: 'width 0.3s ease'
              }}
            />
          </div>
          {progress.currentRow && (
            <div style={{ 
              marginTop: '15px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: '#4a5568'
            }}>
              <span>Current Recipe: {progress.currentRow}</span>
              {output && output.length > 0 && (
                <button
                  onClick={downloadResults}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#4299e1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={e => e.target.style.backgroundColor = '#3182ce'}
                  onMouseOut={e => e.target.style.backgroundColor = '#4299e1'}
                >
                  Download Current Results
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Process Button */}
      <button
        onClick={processing ? stopProcessing : processData}
        disabled={!csvData || prompts.length === 0}
        style={{
          width: '100%',
          padding: '12px',
          border: 'none',
          borderRadius: '6px',
          cursor: (!csvData || prompts.length === 0) ? 'not-allowed' : 'pointer',
          opacity: (!csvData || prompts.length === 0) ? 0.5 : 1,
          backgroundColor: processing ? '#f56565' : '#48bb78',
          color: 'white',
          fontSize: '1.1rem',
          fontWeight: '500',
          transition: 'background-color 0.2s'
        }}
        onMouseOver={e => {
          if (csvData && prompts.length > 0) {
            e.target.style.backgroundColor = processing ? '#e53e3e' : '#38a169';
          }
        }}
        onMouseOut={e => {
          if (csvData && prompts.length > 0) {
            e.target.style.backgroundColor = processing ? '#f56565' : '#48bb78';
          }
        }}
      >
        {processing ? '⏹ Stop Processing' : '▶ Process Data'}
      </button>

      {/* Results Preview */}
      {output && (
        <div style={{ marginTop: '30px' }}>
          <div style={{ 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#2d3748' }}>
              Results ({output.length} rows)
            </h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowPreview(!showPreview)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: showPreview ? '#4a5568' : '#4299e1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={e => e.target.style.backgroundColor = showPreview ? '#2d3748' : '#3182ce'}
                onMouseOut={e => e.target.style.backgroundColor = showPreview ? '#4a5568' : '#4299e1'}
              >
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </button>
              <button
                onClick={downloadResults}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#48bb78',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={e => e.target.style.backgroundColor = '#38a169'}
                onMouseOut={e => e.target.style.backgroundColor = '#48bb78'}
              >
                Download Results
              </button>
              <button
                onClick={clearPreview}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f56565',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={e => e.target.style.backgroundColor = '#e53e3e'}
                onMouseOut={e => e.target.style.backgroundColor = '#f56565'}
              >
                Clear Preview
              </button>
            </div>
          </div>
          {showPreview && (
            <div style={{
              animation: 'fadeIn 0.3s ease-in-out'
            }}>
              <CSVPreview data={output} columns={Object.keys(output[0])} />
            </div>
          )}
        </div>
      )}

      {/* Add the edit dialog */}
      {editingPrompt && (
        <EditPromptDialog
          prompt={editingPrompt}
          onSave={(editedPrompt) => {
            const newPrompts = [...prompts];
            newPrompts[editingPrompt.index] = {
              ...editedPrompt,
              id: prompts[editingPrompt.index].id // Preserve original ID
            };
            setPrompts(newPrompts);
            setEditingPrompt(null);
          }}
          onCancel={() => setEditingPrompt(null)}
        />
      )}

      {/* Failed Cells section */}
      {failedCells.length > 0 && (
        <div style={{ marginTop: '30px' }}>
          <div style={{ 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            padding: '20px',
            backgroundColor: '#fff5f5',
            borderRadius: '6px',
            border: '1px solid #fc8181'
          }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#c53030' }}>
                Failed Cells ({failedCells.length})
              </h2>
              <button
                onClick={() => setShowFailedCells(!showFailedCells)}
                style={{
                  marginTop: '10px',
                  padding: '4px 8px',
                  backgroundColor: 'transparent',
                  border: '1px solid #fc8181',
                  borderRadius: '4px',
                  color: '#c53030',
                  cursor: 'pointer'
                }}
              >
                {showFailedCells ? 'Hide Details' : 'Show Details'}
              </button>
            </div>
            <button
              onClick={reprocessFailedCells}
              disabled={processing}
              style={{
                padding: '8px 16px',
                backgroundColor: processing ? '#cbd5e0' : '#48bb78',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: processing ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              {processing ? 'Processing...' : 'Retry Failed Cells'}
            </button>
          </div>

          {showFailedCells && (
            <div style={{
              marginTop: '10px',
              padding: '20px',
              backgroundColor: '#fff5f5',
              borderRadius: '6px',
              border: '1px solid #fc8181'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Row</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Prompt</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Column</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {failedCells.map((cell, index) => (
                    <tr key={index} style={{ borderTop: '1px solid #fc8181' }}>
                      <td style={{ padding: '8px' }}>{cell.rowIndex + 1}</td>
                      <td style={{ padding: '8px' }}>{cell.promptName}</td>
                      <td style={{ padding: '8px' }}>{cell.outputColumn}</td>
                      <td style={{ padding: '8px' }}>{cell.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add the TokenStats component to the UI */}
      {selectedModel === 'claude' && (
        <div style={{ marginTop: '20px' }}>
          <TokenStats stats={tokenStats} />
        </div>
      )}

      {/* Batch Jobs Status */}
      {batchJobs.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#2d3748' }}>
            Batch Jobs Status
          </h2>
          {batchJobs.map(job => (
            <div key={job.jobId} style={{ 
              padding: '15px',
              backgroundColor: '#f7fafc',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              marginBottom: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Job ID: {job.jobId}</span>
                <span>Status: {job.status}</span>
              </div>
              {job.status !== 'completed' && job.status !== 'failed' && (
                <div style={{ 
                  marginTop: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ width: '100%', height: '8px', backgroundColor: '#edf2f7', borderRadius: '4px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        width: `${(job.processedMessages / job.totalMessages) * 100}%`, 
                        height: '100%', 
                        backgroundColor: '#48bb78', 
                        borderRadius: '4px', 
                        transition: 'width 0.3s ease' 
                      }}
                    />
                  </div>
                  <span style={{ marginLeft: '10px', color: '#718096' }}>
                    {job.processedMessages} / {job.totalMessages} messages processed
                  </span>
                </div>
              )}
              {job.error && (
                <div style={{ color: '#c53030', marginTop: '10px' }}>
                  {job.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AIProcessor;