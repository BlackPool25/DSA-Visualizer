/**
 * ProblemPicker Component
 * 
 * Allows users to select a problem from the available problems.
 * Includes filtering by difficulty and tags.
 */

import { useState, useEffect } from 'react'
import { ChevronDown, Search, Filter } from 'lucide-react'
import { useEditorStore } from '../../stores/editorStore.js'
import { fetchProblems } from '../../services/api.js'
import type { Problem, Difficulty } from '../../types/index.js'

/** Available difficulty levels */
const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard']

/** Common problem tags */
const COMMON_TAGS = [
  'array',
  'linked-list',
  'tree',
  'binary-tree',
  'dynamic-programming',
  'hash-table',
  'string',
  'math',
  'depth-first-search',
  'breadth-first-search',
]

/**
 * ProblemPicker component for selecting and filtering problems
 * 
 * Features:
 * - Search by problem title
 * - Filter by difficulty (Easy/Medium/Hard)
 * - Filter by topic tags
 * - Load problem details on selection
 */
export function ProblemPicker() {
  const [problems, setProblems] = useState<Problem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | ''>('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const { problem, loadProblem } = useEditorStore()

  // Fetch problems on mount
  // Note: Backend returns Problem[] directly, not wrapped in { problems: [...] }
  useEffect(() => {
    async function loadProblems() {
      try {
        setIsLoading(true)
        // Backend /api/problems returns Problem[] array directly
        const problemList = await fetchProblems()
        console.log('Loaded problems:', problemList?.length || 0)
        setProblems(problemList || [])
      } catch (err) {
        console.error('Failed to load problems:', err)
        setError(err instanceof Error ? err.message : 'Failed to load problems')
      } finally {
        setIsLoading(false)
      }
    }

    loadProblems()
  }, [])

  // Filter problems based on search, difficulty, and tags
  const filteredProblems = problems.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.titleSlug.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesDifficulty = !selectedDifficulty || p.difficulty === selectedDifficulty
    const matchesTags = selectedTags.length === 0 ||
      selectedTags.every(tag => p.topicTags.includes(tag))

    return matchesSearch && matchesDifficulty && matchesTags
  })

  // Handle problem selection
  const handleSelect = async (slug: string) => {
    await loadProblem(slug)
    setIsOpen(false)
  }

  // Toggle tag selection
  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  // Get difficulty badge color
  const getDifficultyColor = (difficulty: Difficulty) => {
    switch (difficulty) {
      case 'Easy': return 'bg-green-100 text-green-800 border-green-200'
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'Hard': return 'bg-red-100 text-red-800 border-red-200'
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 bg-white border border-gray-200 rounded-lg">
        <div className="animate-pulse flex space-x-4">
          <div className="h-10 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
        Error loading problems: {error}
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Dropdown trigger - enhanced styling for better visibility */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-slate-50 to-white border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all duration-200 shadow-sm"
      >
        <div className="flex items-center gap-3">
          {/* Problem icon indicator */}
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-inner">
            <span className="text-white text-xs font-bold">
              {problem ? `#${problem.id}` : '?'}
            </span>
          </div>
          <div className="flex flex-col items-start">
            <span className="font-semibold text-gray-800 text-sm">
              {problem ? problem.title : 'Select a problem...'}
            </span>
            {problem && (
              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${getDifficultyColor(problem.difficulty)}`}>
                {problem.difficulty}
              </span>
            )}
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-blue-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[600px] overflow-hidden">
          {/* Search and filters */}
          <div className="p-3 border-b border-gray-200 space-y-3">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search problems..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Difficulty filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value as Difficulty | '')}
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Difficulties</option>
                {DIFFICULTIES.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Tag filter */}
            <div className="flex flex-wrap gap-1.5">
              {COMMON_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-2 py-1 text-xs rounded-full transition-colors ${selectedTags.includes(tag)
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Problem list */}
          <div className="overflow-y-auto max-h-[400px]">
            {filteredProblems.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No problems match your filters
              </div>
            ) : (
              filteredProblems.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelect(p.titleSlug)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${problem?.id === p.id ? 'bg-blue-50' : ''
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">{p.id}. {p.title}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full border ${getDifficultyColor(p.difficulty)}`}>
                      {p.difficulty}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {p.topicTags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-xs text-gray-500">
                        {tag}
                      </span>
                    ))}
                    {p.topicTags.length > 3 && (
                      <span className="text-xs text-gray-400">
                        +{p.topicTags.length - 3} more
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
