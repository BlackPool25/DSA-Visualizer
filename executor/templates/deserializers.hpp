/**
 * @file deserializers.hpp
 * @brief Functions to parse LeetCode-style input formats.
 *
 * This module provides utilities for converting LeetCode test case formats
 * into C++ data structures. It handles the common input formats used in
 * LeetCode problems.
 *
 * Supported Formats:
 * - Arrays: [1,2,3,4,5] -> std::vector<int>
 * - Linked Lists: [1,2,3,4,5] -> ListNode* chain
 * - Binary Trees: [1,2,3,null,null,4,5] -> TreeNode* hierarchy
 * - Matrices: [[1,2],[3,4]] -> std::vector<std::vector<int>>
 *
 * Usage:
 *   #include "templates/deserializers.hpp"
 *
 *   // Build a linked list from array
 *   std::vector<int> values = {1, 2, 3, 4, 5};
 *   ListNode* head = buildList(values);
 *
 *   // Build a binary tree from level-order array
 *   std::vector<std::optional<int>> treeVals = {1, 2, 3, std::nullopt, std::nullopt, 4, 5};
 *   TreeNode* root = buildTree(treeVals);
 *
 * Note:
 *   These functions dynamically allocate memory. The caller is responsible
 *   for cleaning up (though in a LeetCode solution, this is typically not
 *   required as the process exits after running).
 */

#ifndef DESERIALIZERS_HPP
#define DESERIALIZERS_HPP

#include <vector>
#include <queue>
#include <optional>
#include <string>
#include <sstream>
#include <memory>
#include "structures.hpp"

/**
 * @brief Build a linked list from an array of values.
 *
 * Creates a singly-linked list where each array element becomes a node.
 * The nodes are connected in the order they appear in the array.
 *
 * @param values Vector of integers, e.g., {1, 2, 3, 4, 5}
 * @return Head of the linked list, or nullptr if input is empty
 *
 * Example:
 *   Input:  {1, 2, 3}
 *   Output: 1 -> 2 -> 3 -> nullptr
 *
 * GDB Tracing Note:
 *   The tracer will capture each ListNode* and follow the next pointers,
 *   showing the full linked list structure in the heap visualization.
 */
inline ListNode* buildList(const std::vector<int>& values) {
    if (values.empty()) {
        return nullptr;
    }

    // Create head node
    ListNode* head = new ListNode(values[0]);
    ListNode* current = head;

    // Create remaining nodes
    for (size_t i = 1; i < values.size(); i++) {
        current->next = new ListNode(values[i]);
        current = current->next;
    }

    return head;
}

/**
 * @brief Build a binary tree from level-order array.
 *
 * Creates a binary tree from a level-order (breadth-first) representation.
 * Null values (std::nullopt) in the array represent missing nodes.
 *
 * The array follows the standard level-order traversal order:
 * - Index 0: root
 * - For node at index i: left child at 2*i+1, right child at 2*i+2
 *
 * @param values Vector where std::nullopt represents null nodes
 *               e.g., {1, 2, 3, std::nullopt, std::nullopt, 4, 5}
 * @return Root of the tree, or nullptr if input is empty or root is null
 *
 * Example:
 *   Input:  {1, 2, 3, nullopt, nullopt, 4, 5}
 *   Tree:
 *        1
 *       / \
 *      2   3
 *         / \
 *        4   5
 *
 * GDB Tracing Note:
 *   The tracer captures the TreeNode* hierarchy, showing parent-child
 *   relationships in the heap visualization.
 */
inline TreeNode* buildTree(const std::vector<std::optional<int>>& values) {
    if (values.empty() || !values[0].has_value()) {
        return nullptr;
    }

    // Create root
    TreeNode* root = new TreeNode(values[0].value());

    // Use queue for level-order construction
    std::queue<TreeNode*> queue;
    queue.push(root);

    size_t index = 1;

    while (!queue.empty() && index < values.size()) {
        TreeNode* current = queue.front();
        queue.pop();

        // Add left child if available
        if (index < values.size() && values[index].has_value()) {
            current->left = new TreeNode(values[index].value());
            queue.push(current->left);
        }
        index++;

        // Add right child if available
        if (index < values.size() && values[index].has_value()) {
            current->right = new TreeNode(values[index].value());
            queue.push(current->right);
        }
        index++;
    }

    return root;
}

/**
 * @brief Serialize a linked list back to array.
 *
 * Converts a linked list into a vector for output comparison.
 * Traverses the list from head to tail, collecting all values.
 *
 * @param head Head of the linked list
 * @return Vector containing all node values in order
 *
 * Example:
 *   Input:  1 -> 2 -> 3 -> nullptr
 *   Output: {1, 2, 3}
 *
 * Safety Note:
 *   This function handles cycles gracefully by limiting traversal
 *   to 10,000 nodes to prevent infinite loops.
 */
inline std::vector<int> serializeList(ListNode* head) {
    std::vector<int> result;
    ListNode* current = head;

    // Prevent infinite loops on cyclic lists
    const int MAX_NODES = 10000;
    int count = 0;

    while (current != nullptr && count < MAX_NODES) {
        result.push_back(current->val);
        current = current->next;
        count++;
    }

    return result;
}

/**
 * @brief Serialize a binary tree to level-order array.
 *
 * Converts a binary tree back to level-order representation.
 * Uses BFS to traverse the tree level by level.
 *
 * @param root Root of the binary tree
 * @return Vector with values in level-order, nullopt for missing nodes
 *
 * Example:
 *   Input:
 *        1
 *       / \
 *      2   3
 *         / \
 *        4   5
 *   Output: {1, 2, 3, nullopt, nullopt, 4, 5}
 *
 * Note:
 *   Trailing null values are trimmed from the output to match
 *   LeetCode's format (no trailing nulls).
 */
inline std::vector<std::optional<int>> serializeTree(TreeNode* root) {
    if (root == nullptr) {
        return {};
    }

    std::vector<std::optional<int>> result;
    std::queue<TreeNode*> queue;
    queue.push(root);

    while (!queue.empty()) {
        TreeNode* current = queue.front();
        queue.pop();

        if (current != nullptr) {
            result.push_back(current->val);
            queue.push(current->left);
            queue.push(current->right);
        } else {
            result.push_back(std::nullopt);
        }
    }

    // Remove trailing null values
    while (!result.empty() && !result.back().has_value()) {
        result.pop_back();
    }

    return result;
}

/**
 * @brief Parse a string representation of an integer array.
 *
 * Parses strings like "[1,2,3,4,5]" into a vector.
 * Handles various formats with/without spaces.
 *
 * @param str String in format "[1,2,3]" or "[1, 2, 3]"
 * @return Vector of integers
 *
 * Example:
 *   Input:  "[1, 2, 3, 4, 5]"
 *   Output: {1, 2, 3, 4, 5}
 */
inline std::vector<int> parseIntArray(const std::string& str) {
    std::vector<int> result;

    // Remove brackets and spaces
    std::string cleaned;
    for (char c : str) {
        if (c != '[' && c != ']' && c != ' ') {
            cleaned += c;
        }
    }

    // Split by commas
    std::stringstream ss(cleaned);
    std::string item;

    while (std::getline(ss, item, ',')) {
        if (!item.empty()) {
            try {
                result.push_back(std::stoi(item));
            } catch (...) {
                // Skip invalid entries
            }
        }
    }

    return result;
}

/**
 * @brief Parse a string representation of a matrix (2D array).
 *
 * Parses strings like "[[1,2],[3,4]]" into a 2D vector.
 *
 * @param str String in format "[[1,2],[3,4]]"
 * @return 2D vector of integers
 *
 * Example:
 *   Input:  "[[1, 2], [3, 4]]"
 *   Output: {{1, 2}, {3, 4}}
 */
inline std::vector<std::vector<int>> parseMatrix(const std::string& str) {
    std::vector<std::vector<int>> result;

    size_t start = 0;
    while (start < str.length()) {
        // Find next opening bracket of inner array
        size_t arr_start = str.find('[', start);
        if (arr_start == std::string::npos) break;

        // Find closing bracket
        size_t arr_end = str.find(']', arr_start);
        if (arr_end == std::string::npos) break;

        // Extract inner array string
        std::string inner = str.substr(arr_start, arr_end - arr_start + 1);
        result.push_back(parseIntArray(inner));

        start = arr_end + 1;
    }

    return result;
}

#endif // DESERIALIZERS_HPP
