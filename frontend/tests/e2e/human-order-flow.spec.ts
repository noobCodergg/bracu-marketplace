import {expect,test,type BrowserContext,type Page} from '@playwright/test';

const password='BrowserFixture2026!';
async function login(page:Page,email:string,expectedPath:string){
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.locator('form').getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(new RegExp(expectedPath));
}
async function close(context:BrowserContext|undefined){if(context)await context.close()}

test.describe.serial('human marketplace and order journey',()=>{
  let buyerContext:BrowserContext|undefined,sellerContext:BrowserContext|undefined,adminContext:BrowserContext|undefined;
  test.afterAll(async()=>{await close(buyerContext);await close(sellerContext);await close(adminContext)});

  test('a visitor browses, searches, filters, and opens a product',async({browser})=>{
    const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading',{name:'Everything you need is closer than you think.'})).toBeVisible();
    await page.goto('/foods');
    await page.getByPlaceholder('Search products, sellers, categories...').fill('Notebook');
    await expect(page.getByText('Campus Notebook 1',{exact:true})).toBeVisible();
    const discountedCard=page.locator('article').filter({hasText:'Campus Notebook 1'});
    await expect(discountedCard.getByText('৳80',{exact:true})).toBeVisible();
    const originalCardPrice=discountedCard.getByText('৳100',{exact:true});
    await expect(originalCardPrice).toBeVisible();
    await expect(originalCardPrice).toHaveCSS('text-decoration-line','line-through');
    await page.getByLabel('Category').selectOption('Stationery');
    await page.getByLabel('Subcategory').selectOption('Notebooks');
    const cards=page.locator('main article');
    await expect(cards.first()).toBeVisible();
    const columns=await cards.first().evaluate(element=>getComputedStyle(element.parentElement!).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(3);
    await discountedCard.locator('a').click();
    await expect(page.getByRole('button',{name:/Add selected variant/})).toBeVisible();
    const purchasePanel=page.getByRole('complementary');
    await expect(purchasePanel.getByText('৳80',{exact:true}).first()).toBeVisible();
    await expect(purchasePanel.getByText('৳100',{exact:true}).first()).toHaveCSS('text-decoration-line','line-through');
    await context.close();
  });

  test('a buyer signs in, adds a product, and places an order',async({browser})=>{
    buyerContext=await browser.newContext({viewport:{width:390,height:844}});const page=await buyerContext.newPage();
    await login(page,'buyer@browser.test','/buyer/dashboard');
    await page.getByRole('button',{name:'Notifications'}).click();
    const notificationPanel=page.getByRole('dialog',{name:'Notifications panel'});
    await expect(notificationPanel).toBeVisible();
    const notificationBox=await notificationPanel.boundingBox();
    expect(notificationBox).not.toBeNull();
    expect(notificationBox!.x).toBeGreaterThanOrEqual(0);
    expect(notificationBox!.x+notificationBox!.width).toBeLessThanOrEqual(390);
    await page.getByRole('button',{name:'Notifications'}).click();
    await page.goto('/foods');
    await page.getByText('Campus Notebook 1',{exact:true}).click();
    await page.getByRole('button',{name:/Add selected variant/}).click();
    await page.getByRole('button',{name:'View cart'}).click();
    await expect(page.getByRole('heading',{name:'Your cart'})).toBeVisible();
    const delivery=page.getByRole('complementary');
    await delivery.locator('textarea').nth(0).fill('BRAC University, Merul Badda, Dhaka');
    await delivery.locator('input[type="tel"]').fill('01700000000');
    const tomorrow=new Date(Date.now()+86_400_000).toISOString().slice(0,10);
    await page.getByLabel('Date').fill(tomorrow);
    await page.getByLabel('Time').fill('14:30');
    await delivery.locator('textarea').nth(1).fill('Human-like browser test order');
    await page.getByRole('button',{name:'Place order'}).click();
    await expect(page.getByRole('heading',{name:'Order placed successfully'})).toBeVisible();
  });

  test('the seller receives and accepts the buyer order',async({browser})=>{
    sellerContext=await browser.newContext({viewport:{width:1280,height:900}});const page=await sellerContext.newPage();
    await login(page,'seller@browser.test','/seller/dashboard');
    await page.goto('/seller/orders?status=PENDING');
    const status=page.getByLabel('Status for Campus Notebook 1');
    await expect(status).toHaveValue('PENDING');
    await status.selectOption('ACCEPTED');
    await page.goto('/seller/orders?status=ACCEPTED');
    await expect(page.getByLabel('Status for Campus Notebook 1')).toHaveValue('ACCEPTED');
  });

  test('the buyer sees the accepted order and cancels it',async()=>{
    const page=buyerContext!.pages()[0]!;
    await page.goto('/buyer/orders');
    await expect(page.getByText('Campus Notebook 1',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.getByRole('button',{name:'Confirm',exact:true}).click();
    await page.goto('/buyer/orders?status=history');
    await expect(page.getByText('CANCELLED',{exact:true})).toBeVisible();
  });

  test('the seller variant form keeps focus while typing full values',async()=>{
    const page=sellerContext!.pages()[0]!;
    await page.goto('/seller/foods/new');
    await page.locator('select').first().selectOption("Men's Clothing");
    const color=page.getByLabel('Color',{exact:true}),size=page.getByLabel('Size',{exact:true});
    await color.pressSequentially('Navy Blue');
    await expect(color).toHaveValue('Navy Blue');
    await size.pressSequentially('Extra Large');
    await expect(size).toHaveValue('Extra Large');
  });

  test('the seller can use premium analytics decision tools',async()=>{
    const page=sellerContext!.pages()[0]!;
    await page.goto('/seller/analytics');
    await expect(page.getByRole('heading',{name:'Seller decision intelligence'})).toBeVisible();
    await page.getByRole('button',{name:'Start monthly plan'}).click();
    await expect(page.getByText('PREMIUM ANALYTICS · UNLOCKED')).toBeVisible();
    await expect(page.getByRole('heading',{name:'Marketplace Intelligence Suite'})).toBeVisible();
    await expect(page.getByText('What to do today',{exact:true})).toBeVisible();
    await expect(page.getByRole('link',{name:/Manage products|Update inventory|Review orders/}).first()).toBeVisible();
    await expect(page.getByText('Product performance',{exact:true})).toBeVisible();
    await expect(page.getByText('Availability and demand planning',{exact:true})).toBeVisible();
    await expect(page.getByText('Conversion funnel',{exact:false}).first()).toBeVisible();
    await expect(page.getByText('Automated business alerts',{exact:true})).toBeVisible();
    await page.getByPlaceholder('Search product').fill('Notebook 1');
    const productTable=page.getByRole('heading',{name:'Product performance'}).locator('xpath=ancestor::div[contains(@class,"card")]');
    await expect(productTable.getByRole('cell',{name:'Campus Notebook 1',exact:true})).toBeVisible();
    await expect(productTable.getByRole('cell',{name:'Campus Notebook 2',exact:true})).toHaveCount(0);
  });

  test('an admin can open the main administration functions',async({browser})=>{
    adminContext=await browser.newContext({viewport:{width:1280,height:900}});const page=await adminContext.newPage();
    await login(page,'admin@browser.test','/admin/dashboard');
    for(const [path,heading] of [['/admin/users','User management'],['/admin/foods','Product inventory'],['/admin/analytics','Company earnings'],['/admin/system','System analytics']]){
      await page.goto(path);await expect(page.getByRole('heading',{name:heading,exact:false}).first()).toBeVisible();
    }
  });

  test('an admin suspends, reactivates, and bans an account',async({browser})=>{
    test.setTimeout(60_000);
    const seller=await browser.newContext({viewport:{width:390,height:844}}),sellerPage=await seller.newPage();
    await login(sellerPage,'other@browser.test','/seller/dashboard');
    const adminPage=adminContext!.pages()[0]!;
    await adminPage.goto('/admin/users');
    await adminPage.getByPlaceholder('Search name or email...').fill('other@browser.test');
    let row=adminPage.getByRole('row').filter({hasText:'other@browser.test'});
    await row.getByRole('button',{name:'Suspend',exact:true}).click();
    let dialog=adminPage.getByRole('dialog');
    await dialog.getByPlaceholder('Required moderation reason').fill('Human moderation flow test');
    await dialog.locator('select').selectOption('1');
    await dialog.getByRole('button',{name:'Confirm',exact:true}).click();
    await expect(row.getByText('SUSPENDED',{exact:true})).toBeVisible();

    await sellerPage.reload();
    await expect(sellerPage).toHaveURL(/\/login/);
    await login(sellerPage,'other@browser.test','/seller/dashboard');
    await expect(sellerPage.getByRole('heading',{name:'Account suspended'})).toBeVisible();
    await sellerPage.getByPlaceholder('Tell the admin why your account should be reactivated...').fill('I understand the rules and request account review.');
    await sellerPage.getByRole('button',{name:'Request reactivation'}).click();
    await expect(sellerPage.getByText(/application is pending/i)).toBeVisible();

    await adminPage.goto('/admin/approvals');
    const appeal=adminPage.getByText('Other Seller',{exact:true}).locator('xpath=ancestor::div[contains(@class,"card")]');
    await appeal.getByRole('button',{name:'Approve & reactivate'}).click();
    await adminPage.goto('/admin/users');
    await adminPage.getByPlaceholder('Search name or email...').fill('other@browser.test');
    row=adminPage.getByRole('row').filter({hasText:'other@browser.test'});
    await expect(row.getByText('ACTIVE',{exact:true})).toBeVisible();

    await row.getByRole('button',{name:'Ban',exact:true}).click();
    dialog=adminPage.getByRole('dialog');
    await dialog.getByPlaceholder('Required moderation reason').fill('Repeated marketplace policy violation');
    await dialog.locator('select').selectOption('permanent');
    await dialog.getByRole('button',{name:'Confirm',exact:true}).click();
    await expect(row.getByText('BANNED',{exact:true})).toBeVisible();
    await sellerPage.reload();
    await expect(sellerPage).toHaveURL(/\/login/);
    await sellerPage.getByLabel('Email').fill('other@browser.test');
    await sellerPage.getByLabel('Password').fill(password);
    await sellerPage.locator('form').getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(sellerPage.getByRole('main').getByText('This account is banned',{exact:true})).toBeVisible();
    await seller.close();
  });

  test('a frozen seller sees the restriction and can appeal',async({browser})=>{
    const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
    await login(page,'frozen@browser.test','/seller/dashboard');
    await expect(page.getByText('ACCOUNT IS FROZEN',{exact:true})).toBeVisible();
    await expect(page.getByText('Your account is frozen.',{exact:true})).toBeVisible();
    const blocked=await page.evaluate(async()=>{const response=await fetch('/api/v1/products',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:'{}'});return{status:response.status,body:await response.json()}});
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toMatch(/restricted/i);
    await page.getByRole('button',{name:'Apply for reactivation'}).click();
    await page.getByPlaceholder('Write your appeal...').fill('Please review my automatically frozen seller account.');
    await page.getByRole('dialog').getByRole('button',{name:'Submit appeal'}).click();
    await expect(page.getByRole('button',{name:'Appeal pending'})).toBeDisabled();
    const adminPage=adminContext!.pages()[0]!;
    await adminPage.goto('/admin/approvals');
    const appeal=adminPage.getByText('Frozen Seller',{exact:true}).locator('xpath=ancestor::div[contains(@class,"card")]');
    await appeal.getByRole('button',{name:'Reject',exact:true}).click();
    await page.reload();
    await page.getByRole('button',{name:'Apply for reactivation'}).click();
    await page.getByPlaceholder('Write your appeal...').fill('Trying again after rejection on the same day.');
    await page.getByRole('dialog').getByRole('button',{name:'Submit appeal'}).click();
    await expect(page.getByText(/one reactivation application per day/i).first()).toBeVisible();
    await context.close();
  });
});
