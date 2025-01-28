const User = require("../../Models/userModel");

//load the users page
const loadUsers = async (req, res) => {
  try {
    let search = "";
    if (req.query.search) {
      search = req.query.search;
    }

    let page = 1;
    if (req.query.page) {
      page = parseInt(req.query.page);
    }

    const limit = 5;
    const users = await User.find({
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".*", $options: "i" } },
        { email: { $regex: ".*" + search + ".*", $options: "i" } },
      ],
    })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const count = await User.countDocuments({
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".*", $options: "i" } },
        { email: { $regex: ".*" + search + ".*", $options: "i" } },
      ],
    });

    const totalPages = Math.ceil(count / limit);

    res.render("admin/users", {
      currentPage: "users",
      data: users,
      totalPages: totalPages,
      page: page,
      search: search,
      layout: "layouts/admin/layout",
    });
  } catch (error) {
    console.error("Error in loadUsers:", error);
    res.status(500).render("admin/error", { error: "Internal Server Error" });
  }
};
//block the customer
const blockCustomer = async (req, res) => {
  try {
    const userId = req.query.id;
    // await User.findByIdAndUpdate(userId, { isBlocked: true });
    await User.updateOne({ _id: userId }, { $set: { isBlocked: true } });
    res.redirect("/admin/users");
  } catch (error) {
    console.error("Error in blockCustomer:", error);
    res.redirect("/pageError");
  }
};

//unblock the customer
const unBlockCustomer = async (req, res) => {
  try {
    const userId = req.query.id;
    await User.updateOne({ _id: userId }, { $set: { isBlocked: false } });
    // await User.findByIdAndUpdate(userId, { isBlocked: false });
    res.redirect("/admin/users");
  } catch (error) {
    console.error("Error in unBlockCustomer:", error);
    res.redirect("/pageError");
  }
};

module.exports = {
  loadUsers,
  blockCustomer,
  unBlockCustomer,
};
