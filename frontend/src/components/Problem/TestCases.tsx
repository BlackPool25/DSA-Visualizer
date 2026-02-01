/**
 * TestCases Component
 * 
 * Displays test cases for the current problem with input/output
 * comparison and pass/fail status. Allows running individual
 * test cases or all at once.
 */

import { useState } from 'react'
import { Play, Plus, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import { useEditorStore } from '../../stores/editorStore.js'
import type { TestCase } from '../../types/index.js'

/**
 * TestCases component for managing and displaying test cases
 * 
 * Features:
 * - Display sample and custom test cases
 * - Run individual or all test cases
 * - Show pass/fail status with visual indicators
 * - Add custom test cases
 * - View actual vs expected output
 */
export function TestCases() {
  const [activeTab, setActiveTab] = useState(0)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newInput, setNewInput] = useState('')
  const [newExpected, setNewExpected] = useState('')
  
  const {
    testCases,
    addTestCase,
    runTestCase,
    runAllTestCases,
    runResults,
    isLoading,
    setTestCases,
  } = useEditorStore()
  
  // Add a new custom test case
  const handleAddTestCase = () => {
    if (!newInput.trim()) return
    
    const newCase: TestCase = {
      input: newInput.trim(),
      expectedOutput: newExpected.trim(),
      isCustom: true,
    }
    
    addTestCase(newCase)
    setNewInput('')
    setNewExpected('')
    setShowAddForm(false)
    setActiveTab(testCases.length)
  }
  
  // Remove a test case
  const handleRemoveTestCase = (index: number) => {
    const newCases = testCases.filter((_, i) => i !== index)
    setTestCases(newCases)
    if (activeTab >= newCases.length) {
      setActiveTab(Math.max(0, newCases.length - 1))
    }
  }
  
  // Get test result for a specific test case
  const getTestResult = (index: number) => {
    return runResults.get(index)
  }
  
  // Check if test passed (output matches expected)
  const isTestPassed = (index: number): boolean | null => {
    const result = getTestResult(index)
    if (!result) return null
    
    const testCase = testCases[index]
    if (!testCase.expectedOutput) return null
    
    return result.stdout.trim() === testCase.expectedOutput.trim() && result.exitCode === 0
  }
  
  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <h3 className="font-semibold text-gray-700">Test Cases</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => runAllTestCases()}
            disabled={isLoading || testCases.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="w-4 h-4" />
            Run All
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>
      
      {/* Add test case form */}
      {showAddForm && (
        <div className="p-4 border-b border-gray-200 bg-blue-50">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Input</label>
              <textarea
                value={newInput}
                onChange={(e) => setNewInput(e.target.value)}
                placeholder="Enter test input..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected Output</label>
              <textarea
                value={newExpected}
                onChange={(e) => setNewExpected(e.target.value)}
                placeholder="Enter expected output..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddTestCase}
                disabled={!newInput.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                Add Test Case
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Test case tabs */}
      {testCases.length > 0 && (
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {testCases.map((testCase, index) => {
            const result = isTestPassed(index)
            return (
              <button
                key={index}
                onClick={() => setActiveTab(index)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm border-r border-gray-200 whitespace-nowrap transition-colors ${
                  activeTab === index
                    ? 'bg-white text-blue-600 border-b-2 border-b-blue-600'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>Case {index + 1}</span>
                {result === true && <CheckCircle className="w-4 h-4 text-green-500" />}
                {result === false && <XCircle className="w-4 h-4 text-red-500" />}
                {testCase.isCustom && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveTestCase(index)
                    }}
                    className="ml-1 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </button>
            )
          })}
        </div>
      )}
      
      {/* Test case content */}
      <div className="flex-1 overflow-auto p-4">
        {testCases.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No test cases available.</p>
            <p className="text-sm mt-1">Add a custom test case to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {testCases.map((testCase, index) => (
              <div
                key={index}
                className={`space-y-3 ${activeTab === index ? 'block' : 'hidden'}`}
              >
                {/* Input section */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700">Input</label>
                    <button
                      onClick={() => runTestCase(index)}
                      disabled={isLoading}
                      className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 transition-colors"
                    >
                      <Play className="w-3 h-3" />
                      Run
                    </button>
                  </div>
                  <pre className="p-3 bg-gray-50 border border-gray-200 rounded-md text-sm font-mono text-gray-900 overflow-auto">
                    {testCase.input}
                  </pre>
                </div>
                
                {/* Expected output */}
                {testCase.expectedOutput && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expected Output
                    </label>
                    <pre className="p-3 bg-gray-50 border border-gray-200 rounded-md text-sm font-mono text-gray-900 overflow-auto">
                      {testCase.expectedOutput}
                    </pre>
                  </div>
                )}
                
                {/* Actual output */}
                {getTestResult(index) && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-gray-700">Actual Output</label>
                      {isTestPassed(index) === true && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle className="w-3 h-3" />
                          Passed
                        </span>
                      )}
                      {isTestPassed(index) === false && (
                        <span className="flex items-center gap-1 text-xs text-red-600">
                          <XCircle className="w-3 h-3" />
                          Failed
                        </span>
                      )}
                    </div>
                    <pre className={`p-3 border rounded-md text-sm font-mono overflow-auto ${
                      isTestPassed(index) === false ? 'bg-red-50 border-red-200 text-red-900' : 'bg-green-50 border-green-200 text-green-900'
                    }`}>
                      {getTestResult(index)?.stdout || '(no output)'}
                    </pre>
                    
                    {/* Error output */}
                    {getTestResult(index)?.stderr && (
                      <div className="mt-2">
                        <label className="block text-sm font-medium text-red-700 mb-1">
                          Error Output
                        </label>
                        <pre className="p-3 bg-red-50 border border-red-200 rounded-md text-sm font-mono text-red-800 overflow-auto">
                          {getTestResult(index)?.stderr}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
