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
    await page.getByLabel('Category').selectOption('Stationery');
    await page.getByLabel('Subcategory').selectOption('Notebooks');
    const cards=page.locator('main article');
    await expect(cards.first()).toBeVisible();
    const columns=await cards.first().evaluate(element=>getComputedStyle(element.parentElement!).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(3);
    await cards.first().locator('a').click();
    await expect(page.getByRole('button',{name:/Add selected variant/})).toBeVisible();
    await context.close();
  });

  test('a buyer signs in, adds a product, and places an order',async({browser})=>{
    buyerContext=await browser.newContext({viewport:{width:390,height:844}});const page=await buyerContext.newPage();
    await login(page,'buyer@browser.test','/buyer/dashboard');
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
});
