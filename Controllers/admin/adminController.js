const User = require("../../Models/userModel");
const Product = require("../../Models/productModel");
const Order = require("../../Models/orderModel");
const mongoose = require("mongoose");
const Category = require("../../Models/categoryModel");
const Brand = require("../../Models/brandModel");
const Coupon = require("../../Models/couponModel");
const bcrypt = require("bcrypt");
const { create } = require("connect-mongo");
const exceljs = require("exceljs");
const PDFDocument = require("pdfkit");



// Function to handle rendering an error page for the admin
const pageError = async (req, res) => {
  console.log("Rendering admin error page");
  const errorMessage = "An unexpected error occurred while processing your request.";
  const errorCode = 500; // Default error code, can be customized
  res.render("admin/adminError", { errorMessage, errorCode });
};

// Function to hash a password securely using bcrypt
const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.log("error while Securing password", error);
  }
};

// Function to load the admin login page if not logged in
const loadAdminLogin = async (req, res) => {
  try {
    if (req.session.admin) {
      res.redirect("/admin/dashboard");
    } else {
      res.render("admin/adminLogin", { error: null });
    }
  } catch (error) {
    console.error("Error loading admin login:", error);
    res
      .status(500)
      .render("admin/adminLogin", { error: "Internal server error" });
  }
};

// Function to verify admin login requirements
const verifyLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email: email, isAdmin: true });

    if (admin && (await bcrypt.compare(password, admin.password))) {
      req.session.admin = {
        id: admin._id,
        email: admin.email,
      };
      res.redirect("/admin/dashboard");
    } else {
      res.render("admin/adminLogin", { error: "Invalid email or password" });
    }
  } catch (error) {
    console.error("Error in admin login:", error);
    res
      .status(500)
      .render("admin/adminLogin", { error: "Internal server error" });
  }
};

// Function to handle admin logout and destroy the session
const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Error while destroying session ", err);
        return res.redirect("/pageError");
      } else {
        res.redirect("/admin/login");
      }
    });
  } catch (error) {
    console.log("Error while logging out ", error);
    res.redirect("/pageError");
  }
};

// Function to load the admin dashboard
const loadDashboard = async (req, res) => {
  try {

    const topProducts = await Product.aggregate([
      {
        $lookup: {
          from: "orders",
          localField: "_id",
          foreignField: "orderedItems.product",
          as: "orders"
        }
      },
      {
        $unwind: "$orders"
      },
      {
        $unwind: "$orders.orderedItems"
      },
      {
        $match: {
          "$expr": {
            "$eq": ["$_id", "$orders.orderedItems.product"]
          },
          "orders.status": {
            "$nin": ["Cancelled", "Returned", "Return Request", "Failed"]
          }
        }
      },
      {
        $group: {
          _id: "$_id",
          productName: { $first: "$productName" },
          productImage: { $first: "$productImage" },
          totalQuantity: {
            $sum: { $toInt: "$orders.orderedItems.quantity" }
          },
          totalRevenue: {
            $sum: {
              $multiply: [
                { $toDouble: "$orders.orderedItems.quantity" },
                { $toDouble: "$orders.orderedItems.price" }
              ]
            }
          }
        }
      },
      {
        $sort: {
          totalQuantity: -1 
        }
      },
      {
        $limit: 10
      },
      {
        $project: {
          _id: 1,
          productName: 1,
          productImage: 1,
          totalQuantity: 1, 
          totalRevenue: 1
        }
      }
    ]);

    // console.log('topProducts',topProducts);
    
    const topBrands = await Order.aggregate([
      {
        $unwind: "$orderedItems"
      },
      {
        $lookup: {
          from: "products",
          localField: "orderedItems.product",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      {
        $unwind: "$productDetails"
      },
      {
        $lookup: {
          from: "brands",
          localField: "productDetails.brand",
          foreignField: "_id",
          as: "brandDetails"
        }
      },
      {
        $unwind: "$brandDetails"
      },
      {
        $match: {
          "productDetails.isBlocked": false,
          "brandDetails.isBlocked": false,
          "brandDetails.isDeleted": false,
          "orders.status": {
            "$nin": ["Cancelled", "Returned", "Return Request", "Failed"]
          }
        }
      },
      {
        $group: {
          _id: {
            brandId: "$brandDetails._id",
            orderId: "$_id" // Group by brand and unique order ID
          },
          brandName: { $first: "$brandDetails.brandName" },
          totalSales: { $sum: { $multiply: ["$orderedItems.quantity", "$orderedItems.price"] } },
          totalQuantity: { $sum: "$orderedItems.quantity" }
        }
      },
      {
        $group: {
          _id: "$_id.brandId",
          brandName: { $first: "$brandName" },
          totalSales: { $sum: "$totalSales" },
          totalQuantity: { $sum: "$totalQuantity" },
          totalOrders: { $sum: 1 } // Count unique orders per brand
        }
      },
      {
        $addFields: {
          averageOrderValue: { $divide: ["$totalSales", "$totalOrders"] }
        }
      },
      {
        $sort: { totalSales: -1 }
      },
      {
        $limit: 10
      }
    ]);


  const topCategories = await Order.aggregate([
    // Match only valid orders
    {
      $match: {
        status: { 
          $nin: ["Cancelled", "Returned", "Return Request", "Failed"] 
        }
      }
    },
    // Unwind ordered items
    {
      $unwind: "$orderedItems"
    },
    // Lookup product details
    {
      $lookup: {
        from: "products",
        localField: "orderedItems.product",
        foreignField: "_id",
        as: "product"
      }
    },
    {
      $unwind: "$product"
    },
    // Lookup category details
    {
      $lookup: {
        from: "categories",
        localField: "product.category",
        foreignField: "_id",
        as: "category"
      }
    },
    {
      $unwind: "$category"
    },
    // Match only listed categories and non-blocked products
    {
      $match: {
        "category.isListed": true,
        "product.isBlocked": false
      }
    },
    // Group by category
    {
      $group: {
        _id: "$category._id",
        categoryName: { $first: "$category.name" },
        totalOrders: { $sum: 1 },
        totalQuantitySold: { 
          $sum: { $toInt: "$orderedItems.quantity" } 
        },
        totalRevenue: {
          $sum: {
            $multiply: [
              { $toDouble: "$orderedItems.price" },
              { $toDouble: "$orderedItems.quantity" }
            ]
          }
        }
      }
    },
    // Calculate averages and format
    {
      $project: {
        _id: 1,
        categoryName: 1,
        totalOrders: 1,
        totalQuantitySold: 1,
        totalRevenue: { $round: ["$totalRevenue", 2] },
        averageOrderValue: {
          $round: [
            { $divide: ["$totalRevenue", "$totalOrders"] },
            2
          ]
        }
      }
    },
    // Sort by total revenue
    {
      $sort: { totalRevenue: -1 }
    },

    {
      $limit: 10
    }
  ]);

    const totalOrders = await Order.countDocuments();
    const activeOrders = await Order.countDocuments({
      status: { $in: ["Pending", "Processing"] },
    });
    const cancelledOrders = await Order.countDocuments({ status: "Cancelled" });
    const completedOrders = await Order.countDocuments({ status: "Delivered" });
    const returnedOrders = await Order.countDocuments({ status: "Returned" });

    const totalRevenueResult = await Order.aggregate([
      { $group: { _id: null, totalRevenue: { $sum: "$finalAmount" } } },
    ]);

    const totalDiscountResult = await Order.aggregate([
      { $unwind: "$orderedItems" },
      {
        $lookup: {
          from: "products",
          localField: "orderedItems.product",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $addFields: {
          effectiveDiscount: {
            $cond: [
              { $ifNull: ["$productDetails.salePrice", false] },
              {
                $subtract: [
                  "$productDetails.realPrice",
                  "$productDetails.salePrice",
                ],
              },
              {
                $multiply: [
                  "$productDetails.realPrice",
                  { $divide: ["$productDetails.productOffer", 100] },
                ],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalDiscount: {
            $sum: {
              $multiply: ["$orderedItems.quantity", "$effectiveDiscount"],
            },
          },
        },
      },
    ]);

    const couponsApplied = await Order.countDocuments({ couponApplied: true });
    const couponDiscountResult=await Order.aggregate([
      {
        $addFields: {
          couponReduct:{
            $cond:{
              if:{
                $isNumber:"$couponDiscount"
              },
              then:'$couponDiscount',
              else:0
            }
          }
        }
      },
      {
        $group:{
          _id:null,
          couponDiscount:{$sum:"$couponReduct"}
        }
      }
    ])

    const couponDiscount = couponDiscountResult[0]?.couponDiscount || 0;
    const numberOfCustomers = await User.countDocuments();

    totalRevenue = totalRevenueResult[0]?.totalRevenue || 0;
    totalRevenue=parseFloat(totalRevenue.toFixed(2))

    totalDiscount = totalDiscountResult[0]?.totalDiscount || 0;
    totalDiscount=parseFloat(totalDiscount.toFixed(2))

    res.render("admin/adminDashboard", {
      currentPage: "dashboard",
      totalOrders,
      activeOrders,
      cancelledOrders,
      completedOrders,
      returnedOrders,
      totalRevenue,
      totalDiscount,
      couponsApplied,
      numberOfCustomers,
      couponDiscount,
      topProducts,
      topBrands,
      topCategories
    });
  } catch (error) {
    console.log("Error while loading dashboard", error);
    
    res.redirect("/pageError");
  }
};

const filteredAdminDashboard = async (req,res)=>{
  try {
    
    const {startDate,endDate}=req.query;

    const start=new Date(startDate);
    const end=new Date(endDate);
    end.setHours(23,59,59,999) //entire dayss re included

    const orderStats=await Order.aggregate([
      {$match:{
        createdAt:{$gt:start,$lte:end}
      }},
      {$group:{
        _id:null,
        completed:{$sum:{$cond:[{$eq:["$status","Completed"]},1,0]}},
        active: { $sum: { $cond: [{ $eq: ["$status", "Active"] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ["$status", "Cancelled"] }, 1, 0] } },
        returned: { $sum: { $cond: [{ $eq: ["$status", "Returned"] }, 1, 0] } }
      }}
    ])

    const topBrands=await Order.aggregate([
      {$match:{createdAt:{$gte:start,$lte:end}}},
      {$group:{_id:"$brandName",totalSales:{$sum:"$amount"}}},
      {$sort:{totalSales:-1}}
    ])

    res.json({orderStats:orderStats[0],topBrands})

  } catch (error) {
    
    console.error(error);
    res.status(500).json({ error: "Failed to fetch filtered dashboard data" });
  }
}

// Function to load the sales page
const loadSalesPage=async(req,res)=>{
  try {
    const totalRevenueResult = await Order.aggregate([
      { $group: { _id: null, totalRevenue: { $sum: "$finalAmount" } } },
    ])


    const totalDiscountResult = await Order.aggregate([
      { $unwind: "$orderedItems" },
      {
        $lookup: {
          from: "products",
          localField: "orderedItems.product",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $addFields: {
          effectiveDiscount: {
            $cond: [
              { $ifNull: ["$productDetails.salePrice", false] },
              {
                $subtract: [
                  "$productDetails.realPrice",
                  "$productDetails.salePrice",
                ],
              },
              {
                $multiply: [
                  "$productDetails.realPrice",
                  { $divide: ["$productDetails.productOffer", 100] },
                ],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalDiscount: {
            $sum: {
              $multiply: ["$orderedItems.quantity", "$effectiveDiscount"],
            },
          },
        },
      },
    ]);


    // console.log("Total Discount Result in Sales Page:", totalDiscountResult);

    totalRevenue=(totalRevenueResult[0]?.totalRevenue || 0).toFixed(2);
    totalDiscount=(totalDiscountResult[0]?.totalDiscount || 0).toFixed(2);
    const totalOrders = await Order.countDocuments();
    const activeOrders = await Order.countDocuments({
      status: { $in: ["Pending", "Processing"] },
    });
    const cancelledOrders = await Order.countDocuments({ status: "Cancelled" });
    const completedOrders = await Order.countDocuments({ status: "Delivered" });
    const returnedOrders = await Order.countDocuments({ status: "Returned" });
    

    const couponDiscountResult = await Order.aggregate([
      { $group: { _id: null, couponDiscount: { $sum: "$couponDiscount" } } },
    ]);
    const couponDiscount = couponDiscountResult[0]?.couponDiscount || 0;
    const couponsApplied = await Order.countDocuments({ couponApplied: true });
    const numberOfCustomers = await User.countDocuments();
    
    res.render('admin/salesPage',{
      currentPage:'sales',
      totalRevenue,
      totalDiscount,
      totalOrders,
      orders:[],
      activeOrders,
      cancelledOrders,
      completedOrders,
      returnedOrders,
      couponDiscount,
      couponsApplied,
      numberOfCustomers
    });


  } catch (error) {
    console.log(
      "Error in loading sales page in adminController",error);
        res.redirect("/pageError");
    
  }
}

// Function to filter sales report based on date range
const filterSalesReport = async (req, res) => {
    try {
        const { reportType, startDate, endDate } = req.query;
        const currentDay = new Date();
        let startDay, endDay;

        if (startDate && endDate) {
            startDay = new Date(startDate);
            endDay = new Date(endDate);
            endDay.setHours(23, 59, 59, 999);
        } else {
            switch (reportType) {
                case 'daily':
                    startDay = new Date(currentDay.setHours(0, 0, 0, 0));
                    endDay = new Date(currentDay.setHours(23, 59, 59, 999));
                    break;
                case 'weekly':
                    startDay = new Date(currentDay);
                    startDay.setDate(currentDay.getDate() - currentDay.getDay());
                    endDay = new Date(startDay);
                    endDay.setDate(startDay.getDate() + 6);
                    break;

                    
                case 'monthly':
                    startDay = new Date(currentDay.getFullYear(), currentDay.getMonth(), 1);
                    endDay = new Date(currentDay.getFullYear(), currentDay.getMonth() + 1, 0);
                    break;
                default:
                    startDay = new Date(0);
                    endDay = new Date();
            }
        }

         // Fetch orders with individual discounts calculated
          const orders = await Order.aggregate([
          { $match: { createdAt: { $gte: startDay, $lte: endDay } } },
          { $unwind: "$orderedItems" },
          {
              $lookup: {
                  from: "products", // Lookup product dataa
                  localField: "orderedItems.product",
                  foreignField: "_id",
                  as: "productDetails",
              },
          },
          { $unwind: "$productDetails" },
          {
              $lookup: {
                  from: "users", // Lookup user data
                  localField: "user",
                  foreignField: "_id",
                  as: "userDetails",
              },
          },
          { $unwind: "$userDetails" }, // to make sue that user details are included
          {
              $addFields: {
                  effectiveDiscount: {
                      $cond: [
                          { $ifNull: ["$productDetails.salePrice", false] },
                          {
                              $subtract: [
                                  "$productDetails.realPrice",
                                  "$productDetails.salePrice",
                              ],
                          },
                          {
                              $multiply: [
                                  "$productDetails.realPrice",
                                  { $divide: ["$productDetails.productOffer", 100] },
                              ],
                          },
                      ],
                  },
              },
          },
          {
              $group: {
                  _id: "$_id",
                  user: { $first: "$userDetails" }, // Include user details
                  createdAt: { $first: "$createdAt" },
                  finalAmount: { $first: "$finalAmount" },
                  status: { $first: "$status" },
                  totalDiscount: {
                      $sum: { $multiply: ["$orderedItems.quantity", "$effectiveDiscount"] },
                  },
              },
          },
          { $sort: { createdAt: -1 } },
      ]);
      
      const orderTotal = Math.floor(
        orders.reduce((sum, order) => sum + (order.finalAmount || 0), 0)
    );
    
    const totalDiscount = Math.floor(
        orders.reduce((sum, order) => sum + (order.totalDiscount || 0), 0)
    );
    
        //   const orders = await Order.find({
      //       createdAt: { $gte: startDay, $lte: endDay }
      //   })
      //   .populate('user', 'name email phone')
      //   .select("finalAmount orderedItems totalDiscount couponDiscount createdAt")
      //   .sort({ createdAt: -1 });

      //   const orderTotal = orders.reduce((sum, order) => sum + (order.finalAmount || 0), 0);
      //   const totalDiscountResult = await Order.aggregate([
      //     { $match: { createdAt: { $gte: startDay, $lte: endDay } } },
      //     { $unwind: "$orderedItems" },
      //     {
      //         $lookup: {
      //             from: "products",
      //             localField: "orderedItems.product",
      //             foreignField: "_id",
      //             as: "productDetails",
      //         },
      //     },
      //     { $unwind: "$productDetails" },
      //     {
      //         $addFields: {
      //             effectiveDiscount: {
      //                 $cond: [
      //                     { $ifNull: ["$productDetails.salePrice", false] },
      //                     {
      //                         $subtract: [
      //                             "$productDetails.realPrice",
      //                             "$productDetails.salePrice",
      //                         ],
      //                     },
      //                     {
      //                         $multiply: [
      //                             "$productDetails.realPrice",
      //                             { $divide: ["$productDetails.productOffer", 100] },
      //                         ],
      //                     },
      //                 ],
      //             },
      //         },
      //     },
      //     {
      //         $group: {
      //             _id: null,
      //             totalDiscount: {
      //                 $sum: {
      //                     $multiply: ["$orderedItems.quantity", "$effectiveDiscount"],
      //                 },
      //             },
      //         },
      //     },
      // ]);
      // const totalDiscount = totalDiscountResult[0]?.totalDiscount || 0;
      
        const couponDiscount = orders.reduce((sum, order) => sum + (order.couponDiscount || 0), 0);
        const couponsApplied = await Order.countDocuments({ couponApplied: true });
        console.log('couponsApplied:------------------', couponsApplied);
        
        res.render('admin/salesPage', {
            currentPage: 'sales',
            orders,
            totalRevenue: orderTotal.toFixed(2),
            totalDiscount: totalDiscount.toFixed(2),
            couponDiscount: couponDiscount.toFixed(2),
            // couponsApplied,
            totalOrders: orders.length
        });
    } catch (error) {
        console.error("Error in filtering sales report:", error);
        res.redirect("/pageError");
    }
};

// Function to fetch orders by date range
const ordersByDateRange = async (startDate, endDate) => {
  try {
      console.log("startDate:", startDate);
      console.log("endDate:", endDate);

      if (!startDate || !endDate) {
          throw new Error("Start date or end date is missing.");
      }

      const startDay = new Date(startDate);
      const endDay = new Date(endDate);

       // Ensure endDay covers the entire day
      endDay.setHours(23, 59, 59, 999);
      if (isNaN(startDay.getTime()) || isNaN(endDay.getTime())) {
          throw new Error("Invalid date format. Please use 'YYYY-MM-DD'.");
      }

      const orders = await Order.find({
          createdAt: { $gte: startDay, $lte: endDay },
      }).populate('user', 'name email phone')
          .sort({ createdAt: -1 });

      return orders;
  } catch (error) {
      console.error("Error fetching orders by date range:", error.message);
      throw error;
  }
};

// Excel Report
const excelReportDownload = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const orders = await ordersByDateRange(startDate, endDate);

        const workbook = new exceljs.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        worksheet.addRow([
            'Order ID',
            'Date',
            'Customer Name',
            'Email',
            'Phone',
            'Status',
            'Subtotal',
            'Discount',
            'Coupon Discount',
            'Final Amount',
            'Payment Method'
        ]);

        orders.forEach(order => {
            worksheet.addRow([
                order._id.toString(),
                new Date(order.createdAt).toLocaleDateString(),
                order.user?.name || 'N/A',
                order.user?.email || 'N/A',
                order.user?.phone || 'N/A',
                order.status,
                order.totalAmount,
                order.totalDiscount,
                order.couponDiscount,
                order.finalAmount,
                order.paymentMethod
            ]);
        });

        worksheet.getRow(1).font = { bold: true };
        worksheet.columns.forEach(column => {
            column.width = 15;
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Error in downloading excel report:", error);
        res.status(500).send("Error generating report");
    }
};

// PDF Report
const downloadPDFreport = async (req, res) => {
  try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
          return res.status(400).send("Start and end dates are required.");
      }

      const orders = await ordersByDateRange(startDate, endDate);

      const doc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');
      doc.pipe(res);

      doc.fontSize(20).text('Sales Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`, { align: 'center' });
      doc.moveDown();

      const totalAmount = orders.reduce((sum, order) => sum + (order.finalAmount || 0), 0);
      const totalDiscount = orders.reduce((sum, order) => sum + (order.totalDiscount || 0), 0);
      const couponDiscount = orders.reduce((sum, order) => sum + (order.couponDiscount || 0), 0);

      doc.text(`Total Orders: ${orders.length}`);
      doc.text(`Total Amount: ₹${totalAmount.toFixed(2)}`);
      doc.text(`Total Discount: ₹${totalDiscount.toFixed(2)}`);
      doc.text(`Coupon Discount: ₹${couponDiscount.toFixed(2)}`);
      doc.moveDown();

      doc.text('Order Details:', { underline: true });
      orders.forEach((order, index) => {
          doc.moveDown();
          doc.text(`Order ${index + 1}:`);
          doc.text(`Order ID: ${order._id}`);
          doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`);
          doc.text(`Customer: ${order.user?.name || 'N/A'}`);
          doc.text(`Status: ${order.status}`);
          doc.text(`Amount: ₹${order.finalAmount}`);
          doc.text(`Payment: ${order.paymentMethod}`);
      });

      doc.end();
  } catch (error) {
      console.error("Error generating PDF report:", error.message);
      res.status(500).send("Error generating report");
  }
};

module.exports = {
  pageError,
  loadAdminLogin,
  verifyLogin,
  securePassword,
  logout,
  loadDashboard,
  loadSalesPage,
  filterSalesReport,
  excelReportDownload,
  downloadPDFreport,
  ordersByDateRange,
  filteredAdminDashboard
};


