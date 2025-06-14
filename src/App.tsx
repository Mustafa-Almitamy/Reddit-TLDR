import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import SearchForm from './components/SearchForm';
import LoadingState from './components/LoadingState';
import StackedResults from './components/StackedResults';
import Summary from './components/Summary';
import Footer from './components/Footer';
import DarkModeToggle from './components/DarkModeToggle';
import { searchReddit } from './utils/reddit';
import { analyzeSentiment, aggregateResults } from './utils/gemini';
import { AnalysisResult, AggregatedResult, SentimentCounts } from './types';

function App() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true' || 
             (!localStorage.getItem('darkMode') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [aggregatedResult, setAggregatedResult] = useState<AggregatedResult | null>(null);
  const [currentStage, setCurrentStage] = useState<'fetching' | 'analyzing' | 'aggregating'>('fetching');
  const [currentPost, setCurrentPost] = useState(0);
  const [totalPosts, setTotalPosts] = useState(0);
  const [sentimentCounts, setSentimentCounts] = useState<SentimentCounts>({
    positive: 0,
    negative: 0,
    mixed: 0,
    neutral: 0
  });
  const [dataRetrievalTime, setDataRetrievalTime] = useState(0);
  const [llmProcessingTime, setLlmProcessingTime] = useState(0);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', isDark.toString());
  }, [isDark]);

  const toggleDarkMode = () => {
    setIsDark(!isDark);
  };

  const handleSearch = async (query: string, apiKey: string, postLimit: number, maxRetries: number, selectedModel: string) => {
    setIsAnalyzing(true);
    setAnalysisResults([]);
    setAggregatedResult(null);
    setCurrentPost(0);
    setTotalPosts(0);
    setKeyword(query);
    setSentimentCounts({ positive: 0, negative: 0, mixed: 0, neutral: 0 });

    try {
      // Stage 1: Fetch Reddit data
      setCurrentStage('fetching');
      const dataStartTime = Date.now();
      
      const posts = await searchReddit(query, postLimit);
      setTotalPosts(posts.length);
      
      const dataEndTime = Date.now();
      setDataRetrievalTime((dataEndTime - dataStartTime) / 1000);

      if (posts.length === 0) {
        alert('No posts found for this search term. Try a different keyword.');
        setIsAnalyzing(false);
        return;
      }

      // Stage 2: Analyze sentiment for each post
      setCurrentStage('analyzing');
      const llmStartTime = Date.now();
      
      const results: AnalysisResult[] = [];
      const allPositives: string[] = [];
      const allNegatives: string[] = [];
      const counts: SentimentCounts = { positive: 0, negative: 0, mixed: 0, neutral: 0 };

      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        setCurrentPost(i + 1);

        try {
          const result = await analyzeSentiment(post, query, apiKey, maxRetries, selectedModel);
          const analysisResult: AnalysisResult = { post, result };
          
          results.push(analysisResult);
          setAnalysisResults([...results]);

          if (result) {
            // Count sentiments
            const sentiment = result.sentiment.toLowerCase() as keyof SentimentCounts;
            if (sentiment in counts) {
              counts[sentiment]++;
              setSentimentCounts({ ...counts });
            }

            // Collect positive and negative points
            allPositives.push(...result.positives);
            allNegatives.push(...result.negatives);
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error analyzing post ${i + 1}:`, error);
          const analysisResult: AnalysisResult = { post, result: null };
          results.push(analysisResult);
          setAnalysisResults([...results]);
        }
      }

      // Stage 3: Aggregate results
      setCurrentStage('aggregating');
      
      if (allPositives.length > 0 || allNegatives.length > 0) {
        try {
          const aggregated = await aggregateResults(allPositives, allNegatives, query, apiKey, maxRetries, selectedModel);
          setAggregatedResult(aggregated);
        } catch (error) {
          console.error('Error aggregating results:', error);
        }
      }

      const llmEndTime = Date.now();
      setLlmProcessingTime((llmEndTime - llmStartTime) / 1000);

    } catch (error) {
      console.error('Error during analysis:', error);
      if (error instanceof Error) {
        alert(`Error: ${error.message}`);
      } else {
        alert('An unexpected error occurred during analysis.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      <DarkModeToggle isDark={isDark} onToggle={toggleDarkMode} />
      <Header />
      
      <div className="container mx-auto max-w-6xl pb-12">
        <SearchForm onSearch={handleSearch} isAnalyzing={isAnalyzing} />

        {isAnalyzing && (
          <LoadingState 
            stage={currentStage} 
            currentPost={currentPost} 
            totalPosts={totalPosts} 
          />
        )}

        {analysisResults.length > 0 && (
          <StackedResults analysisResults={analysisResults} />
        )}

        {!isAnalyzing && analysisResults.length > 0 && (
          <Summary
            aggregatedResult={aggregatedResult}
            sentimentCounts={sentimentCounts}
            dataRetrievalTime={dataRetrievalTime}
            llmProcessingTime={llmProcessingTime}
            keyword={keyword}
          />
        )}
      </div>

      <Footer />
    </div>
  );
}

export default App;