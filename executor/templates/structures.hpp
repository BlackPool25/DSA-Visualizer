/**
 * @file structures.hpp
 * @brief Standard data structure definitions matching LeetCode conventions.
 *
 * These structures are used to deserialize LeetCode test inputs and
 * are recognized by the GDB tracer for special visualization.
 *
 * The GDB tracer specifically looks for these type names when serializing
 * pointer values to the heap. When it encounters a ListNode* or TreeNode*,
 * it knows to treat the pointed-to object as a data structure node.
 *
 * Usage:
 *   #include "templates/structures.hpp"
 *
 *   ListNode* head = new ListNode(1);
 *   head->next = new ListNode(2);
 */

#ifndef STRUCTURES_HPP
#define STRUCTURES_HPP

#include <vector>

/**
 * @brief Singly-linked list node.
 *
 * Standard LeetCode linked list node structure.
 * Used in problems like:
 * - Reverse Linked List
 * - Merge Two Sorted Lists
 * - Linked List Cycle
 * - Add Two Numbers
 *
 * The val field holds the data value.
 * The next field points to the next node or nullptr at end.
 *
 * GDB Tracing Note:
 * When the tracer sees a ListNode*, it dereferences it and adds the
 * node to the heap with all fields (val, next) serialized.
 */
struct ListNode {
    int val;           /**< Node value */
    ListNode *next;    /**< Pointer to next node */

    /**
     * Default constructor - creates node with value 0
     */
    ListNode() : val(0), next(nullptr) {}

    /**
     * Value constructor - creates node with given value
     * @param x The integer value to store
     */
    ListNode(int x) : val(x), next(nullptr) {}

    /**
     * Full constructor - creates node with value and next pointer
     * @param x The integer value to store
     * @param next Pointer to next node
     */
    ListNode(int x, ListNode *next) : val(x), next(next) {}
};

/**
 * @brief Binary tree node.
 *
 * Standard LeetCode binary tree node structure.
 * Used in problems like:
 * - Invert Binary Tree
 * - Binary Tree Level Order Traversal
 * - Maximum Depth of Binary Tree
 * - Validate Binary Search Tree
 *
 * The val field holds the data value.
 * The left and right fields point to child nodes.
 *
 * GDB Tracing Note:
 * TreeNode* pointers are tracked in the heap. The tracer builds a
 * complete picture of the tree by following left/right pointers.
 */
struct TreeNode {
    int val;            /**< Node value */
    TreeNode *left;     /**< Pointer to left child */
    TreeNode *right;    /**< Pointer to right child */

    /**
     * Default constructor - creates node with value 0
     */
    TreeNode() : val(0), left(nullptr), right(nullptr) {}

    /**
     * Value constructor - creates node with given value
     * @param x The integer value to store
     */
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}

    /**
     * Full constructor - creates node with value and children
     * @param x The integer value to store
     * @param left Pointer to left child
     * @param right Pointer to right child
     */
    TreeNode(int x, TreeNode *left, TreeNode *right)
        : val(x), left(left), right(right) {}
};

/**
 * @brief N-ary tree node (for problems like N-ary Tree Level Order Traversal).
 *
 * Used in problems like:
 * - N-ary Tree Preorder Traversal
 * - N-ary Tree Postorder Traversal
 * - Maximum Depth of N-ary Tree
 *
 * Unlike binary trees, each node can have any number of children.
 * The children are stored in a vector for dynamic sizing.
 *
 * GDB Tracing Note:
 * The children vector is serialized using the STL printer, showing
 * all child nodes and their relationships.
 */
struct Node {
    int val;                          /**< Node value */
    std::vector<Node*> children;      /**< Vector of child pointers */

    /**
     * Default constructor
     */
    Node() : val(0) {}

    /**
     * Value constructor
     * @param _val The integer value to store
     */
    Node(int _val) : val(_val) {}

    /**
     * Full constructor with children
     * @param _val The integer value to store
     * @param _children Vector of child pointers
     */
    Node(int _val, std::vector<Node*> _children) : val(_val), children(_children) {}
};

/**
 * @brief Graph node (for graph problems like Clone Graph).
 *
 * Used in problems like:
 * - Clone Graph
 * - Course Schedule (prerequisite detection)
 *
 * Each node has a value and a list of neighboring nodes.
 * The neighbors vector represents the adjacency list.
 *
 * GDB Tracing Note:
 * The neighbors vector and val field are both serialized.
 * Cycles in the graph are detected using address tracking.
 */
struct GraphNode {
    int val;                           /**< Node value */
    std::vector<GraphNode*> neighbors; /**< Adjacent nodes */

    /**
     * Default constructor
     */
    GraphNode() : val(0) {}

    /**
     * Value constructor
     * @param _val The integer value
     */
    GraphNode(int _val) : val(_val) {}

    /**
     * Full constructor with neighbors
     * @param _val The integer value
     * @param _neighbors List of neighboring nodes
     */
    GraphNode(int _val, std::vector<GraphNode*> _neighbors)
        : val(_val), neighbors(_neighbors) {}
};

#endif // STRUCTURES_HPP
