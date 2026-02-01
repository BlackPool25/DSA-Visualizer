/**
 * @file two_sum.cpp
 * @brief Sample solution for LeetCode 1: Two Sum
 *
 * This solution demonstrates hash map usage with unordered_map.
 * The tracer should capture the growth of the 'seen' hash map
 * and lookups at each iteration.
 *
 * Problem: Find two numbers in array that add up to target.
 * Input:  nums = [2,7,11,15], target = 9
 * Output: [0,1] (indices of 2 and 7)
 *
 * GDB Trace Expectations:
 * - The 'seen' unordered_map should grow with each iteration
 * - Hash map internals (buckets, entries) should be visible
 * - Array access and complement calculation at each step
 *
 * Compilation:
 *   g++ -g -std=c++17 two_sum.cpp -o two_sum
 */

#include <iostream>
#include <vector>
#include <unordered_map>
#include <sstream>

/**
 * @brief Solution class for Two Sum problem
 */
class Solution {
public:
    /**
     * @brief Finds two numbers that add up to target using hash map.
     *
     * Algorithm:
     * 1. Iterate through array
     * 2. For each number, calculate complement (target - num)
     * 3. Check if complement exists in hash map
     * 4. If yes, return indices; if no, add current to map
     *
     * @param nums Array of integers
     * @param target Target sum
     * @return Vector with indices of the two numbers
     */
    std::vector<int> twoSum(std::vector<int>& nums, int target) {
        // Hash map to store value -> index
        std::unordered_map<int, int> seen;

        for (int i = 0; i < static_cast<int>(nums.size()); i++) {
            int num = nums[i];
            int complement = target - num;

            // Check if complement exists in map
            auto it = seen.find(complement);
            if (it != seen.end()) {
                // Found! Return indices
                return {it->second, i};
            }

            // Add current number to map
            seen[num] = i;
        }

        return {};  // No solution found
    }
};

/**
 * @brief Parse input line into vector of integers
 * @param line Input string like "[2,7,11,15]"
 * @return Vector of integers
 */
std::vector<int> parseInput(const std::string& line) {
    std::vector<int> result;
    std::string cleaned;

    // Remove brackets and spaces
    for (char c : line) {
        if (c != '[' && c != ']' && c != ' ') {
            cleaned += c;
        }
    }

    // Split by commas
    std::stringstream ss(cleaned);
    std::string item;
    while (std::getline(ss, item, ',')) {
        if (!item.empty()) {
            result.push_back(std::stoi(item));
        }
    }

    return result;
}

/**
 * @brief Main function - test harness
 *
 * Reads input from stdin in format:
 *   [2,7,11,15]
 *   9
 */
int main() {
    // Read array
    std::string line;
    std::getline(std::cin, line);
    std::vector<int> nums = parseInput(line);

    // Read target
    int target;
    std::cin >> target;

    // Run solution
    Solution sol;
    std::vector<int> result = sol.twoSum(nums, target);

    // Output result
    std::cout << "[";
    for (size_t i = 0; i < result.size(); i++) {
        if (i > 0) std::cout << ",";
        std::cout << result[i];
    }
    std::cout << "]" << std::endl;

    return 0;
}
