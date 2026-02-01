/**
 * @file binary_tree_inorder.cpp
 * @brief Sample solution for LeetCode 94: Binary Tree Inorder Traversal
 *
 * This solution demonstrates recursive tree traversal.
 * The tracer should capture the call stack growth as recursion deepens,
 * and the tree structure in the heap.
 *
 * Problem: Return the inorder traversal of a binary tree's values.
 * Input:  root = [1,null,2,3]
 * Output: [1,3,2]
 *
 * GDB Trace Expectations:
 * - Call stack should grow with each recursive call
 * - Tree nodes should be visible in heap
 * - Left/child pointer navigation at each step
 *
 * Compilation:
 *   g++ -g -std=c++17 binary_tree_inorder.cpp -o binary_tree_inorder
 */

#include <iostream>
#include <vector>
#include <optional>
#include "../templates/structures.hpp"
#include "../templates/deserializers.hpp"

/**
 * @brief Solution class for inorder traversal
 */
class Solution {
public:
    /**
     * @brief Performs inorder traversal of binary tree.
     *
     * Inorder traversal order: left subtree, root, right subtree
     * This produces values in sorted order for a BST.
     *
     * @param root Root of binary tree
     * @return Vector of values in inorder sequence
     */
    std::vector<int> inorderTraversal(TreeNode* root) {
        std::vector<int> result;
        inorderHelper(root, result);
        return result;
    }

private:
    /**
     * @brief Recursive helper for inorder traversal.
     *
     * @param node Current node being visited
     * @param result Vector to collect values
     */
    void inorderHelper(TreeNode* node, std::vector<int>& result) {
        if (node == nullptr) {
            return;
        }

        // Visit left subtree
        inorderHelper(node->left, result);

        // Visit current node
        result.push_back(node->val);

        // Visit right subtree
        inorderHelper(node->right, result);
    }
};

/**
 * @brief Parse tree input from string
 * @param line String like "[1,null,2,3]"
 * @return Vector of optional integers
 */
std::vector<std::optional<int>> parseTreeInput(const std::string& line) {
    std::vector<std::optional<int>> result;
    std::string current;

    for (size_t i = 1; i < line.length() - 1; i++) {  // Skip brackets
        char c = line[i];

        if (c == ',') {
            // Process current token
            if (current == "null" || current == "nullptr") {
                result.push_back(std::nullopt);
            } else if (!current.empty()) {
                result.push_back(std::stoi(current));
            }
            current.clear();
        } else if (c != ' ' && c != '[' && c != ']') {
            current += c;
        }
    }

    // Process last token
    if (!current.empty()) {
        if (current == "null" || current == "nullptr") {
            result.push_back(std::nullopt);
        } else {
            result.push_back(std::stoi(current));
        }
    }

    return result;
}

/**
 * @brief Main function - test harness
 *
 * Reads input from stdin in format: [1,null,2,3]
 */
int main() {
    // Read input
    std::string line;
    std::getline(std::cin, line);

    // Parse tree input
    std::vector<std::optional<int>> values = parseTreeInput(line);

    // Build tree
    TreeNode* root = buildTree(values);

    // Run solution
    Solution sol;
    std::vector<int> result = sol.inorderTraversal(root);

    // Output result
    std::cout << "[";
    for (size_t i = 0; i < result.size(); i++) {
        if (i > 0) std::cout << ",";
        std::cout << result[i];
    }
    std::cout << "]" << std::endl;

    return 0;
}
